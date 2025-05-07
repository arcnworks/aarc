import got from 'got';
import lqip from 'lqip-modern';
import pMap from 'p-map';
import pMemoize from 'p-memoize';
import { ExtendedRecordMap, PreviewImage, PreviewImageMap } from 'notion-types';
import { getPageImageUrls, normalizeUrl } from 'notion-utils';

import { defaultPageIcon, defaultPageCover } from './config';
import { db } from './db';
import { mapImageUrl } from './map-image-url';

export async function getPreviewImageMap(recordMap: ExtendedRecordMap): Promise<PreviewImageMap> {
  const urls: string[] = getPageImageUrls(recordMap, {
    mapImageUrl,
  })
    .concat([defaultPageIcon, defaultPageCover])
    .filter(Boolean);

  const previewImagesMap = Object.fromEntries(
    await pMap(
      urls,
      async url => {
        const cacheKey = normalizeUrl(url);

        // ✅ 썸네일 생성을 완전히 생략하고 싶은 URL 조건 예시 (GIF, Notion 내부 프록시 등)
        if (url.endsWith('.gif') || url.includes('notion.so/image/')) {
          return [cacheKey, null];
        }

        return [cacheKey, await getPreviewImage(url, { cacheKey })];
      },
      {
        concurrency: 5, // 병렬 수 줄여서 서버 과부하 방지
      },
    ),
  );

  return previewImagesMap;
}

async function createPreviewImage(
  url: string,
  { cacheKey }: { cacheKey: string },
): Promise<PreviewImage | null> {
  try {
    const cachedPreviewImage = await db.get(cacheKey);
    if (cachedPreviewImage) {
      return cachedPreviewImage;
    }
  } catch (err) {
    console.warn(`redis error get "${cacheKey}"`, err.message);
  }

  try {
    const response = await got(url, {
      responseType: 'buffer' as const,
      timeout: { request: 8000 },
    });
    const body = response.body;
    const result = await lqip(body);
  
    const previewImage = {
      originalWidth: result.metadata.originalWidth,
      originalHeight: result.metadata.originalHeight,
      dataURIBase64: result.metadata.dataURIBase64,
    };
  

    try {
      await db.set(cacheKey, previewImage);
    } catch (err) {
      console.warn(`redis error set "${cacheKey}"`, err.message);
    }

    return previewImage;
  } catch (err) {
    // ✅ 불필요한 로그 제거: 흔한 실패는 무시
    const ignoredErrors = ['Response code 400', 'Response code 401', '404 Not Found'];
    const isSafeToIgnore = ignoredErrors.some(msg => err.message.includes(msg));

    if (!isSafeToIgnore && !err.message.includes('unsupported image format')) {
      console.warn('failed to create preview image', url, err.message);
    }

    return null;
  }
}

export const getPreviewImage = pMemoize(createPreviewImage);
