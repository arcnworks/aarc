// pages/[pageId].tsx

import * as React from 'react';
import { GetStaticProps } from 'next';
import { isDev, domain } from 'lib/config';
import { getSiteMap } from 'lib/get-site-map';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '../components/Meta';

import { ExtendedRecordMap } from 'notion-types';
import { getPageImageUrls } from 'notion-utils';
import { mapImageUrl } from 'lib/map-image-url';

/**
 * recordMap 내부 모든 이미지 URL을 mapImageUrl 로 치환해 줍니다.
 * 이렇게 하면 빌드된 HTML에도 expired signed URL이 포함되지 않습니다.
 */
function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  // 모든 안전한 URL을 미리 수집
  getPageImageUrls(recordMap, { mapImageUrl }).forEach(() => {
    // recordMap.block 을 순회하며 실제 값을 수정
    Object.entries(recordMap.block).forEach(([blockId, { value: block }]) => {
      if (!block) return;

      // 이미지 블록인 경우 signed_urls 와 properties.source 치환
      if (block.type === 'image') {
        if (recordMap.signed_urls?.[blockId]) {
          recordMap.signed_urls[blockId] = mapImageUrl(
            recordMap.signed_urls[blockId],
            block
          )!;
        }
        const src = block.properties?.source?.[0]?.[0];
        if (src) {
          block.properties.source[0][0] = mapImageUrl(src, block)!;
        }
      }

      // 페이지 커버, 북마크 커버/아이콘 치환
      const format = (block.format as any) || {};
      if (format.page_cover) {
        format.page_cover = mapImageUrl(format.page_cover, block)!;
      }
      if (format.bookmark_cover) {
        format.bookmark_cover = mapImageUrl(format.bookmark_cover, block)!;
      }
      if (format.bookmark_icon) {
        format.bookmark_icon = mapImageUrl(format.bookmark_icon, block)!;
      }

      // 블록 아이콘 치환
      if (block.icon && typeof block.icon === 'string') {
        block.icon = mapImageUrl(block.icon, block)!;
      }
    });
  });

  return recordMap;
}

export const getStaticProps: GetStaticProps<PageProps, Params> = async (
  context
) => {
  const rawPageId = context.params!.pageId as string;

  try {
    // 1) Notion 페이지 데이터 가져오기
    const props = await resolveNotionPage(domain, rawPageId);

    // 2) recordMap 내 모든 이미지 URL을 안전하게 치환
    props.recordMap = sanitizeRecordMap(props.recordMap);

    return {
      props,
      revalidate: 5, // ISR 주기
    };
  } catch (err) {
    console.error('page error', domain, rawPageId, err);
    throw err;
  }
};

export async function getStaticPaths() {
  if (isDev) {
    return {
      paths: [],
      fallback: true,
    };
  }

  const siteMap = await getSiteMap();

  return {
    paths: Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
      params: { pageId },
    })),
    fallback: true,
  };
}

// 메타 정보 자동 생성 함수
function generateMeta(page: any) {
  const title =
    page?.properties?.title?.[0]?.[0] ||
    'AaRC | 느낌과 공간을 연결하는 건축 스튜디오';

  const description =
    page?.properties?.['ZbRi']?.[0]?.[0] ||
    'AaRC(아크)는 과학적 통찰과 인문적 감수성으로 느낌의 경험을 담는 특별한 공간을 디자인합니다.';

  const image =
    page?.cover?.external?.url ||
    page?.cover?.file?.url ||
    'https://aarc.kr/og-image.jpg';

  const url = `https://aarc.kr/${page?.id?.replace(/-/g, '')}`;

  return { title, description, image, url };
}

export default function NotionDomainDynamicPage(props: PageProps) {
  const { page } = props;
  const meta = generateMeta(page);

  return (
    <>
      <Meta
        title={meta.title}
        description={meta.description}
        image={meta.image}
      />
      <NotionPage {...props} />
    </>
  );
}
