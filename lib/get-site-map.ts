import pMemoize from 'p-memoize';
import { getAllPagesInSpace } from 'notion-utils';
import ExpiryMap from 'expiry-map';

import { includeNotionIdInUrls } from './config';
import { notion } from './notion-api';
import { getCanonicalPageId } from './get-canonical-page-id';
import * as config from './config';
import * as types from './types';

const uuid = !!includeNotionIdInUrls;
const cache = new ExpiryMap(10000);

export async function getSiteMap(): Promise<types.SiteMap> {
  const partialSiteMap = await getAllPages(config.rootNotionPageId, config.rootNotionSpaceId);

  return {
    site: config.site,
    ...partialSiteMap,
  } as types.SiteMap;
}

const getAllPages = pMemoize(getAllPagesImpl, {
  cacheKey: (...args) => JSON.stringify(args),
  cache,
});

async function getAllPagesImpl(
  rootNotionPageId: string,
  rootNotionSpaceId: string,
): Promise<Partial<types.SiteMap>> {
  const getPage = async (pageId: string, ...args) => {
    return notion.getPage(pageId, ...args);
  };

  const pageMap = await getAllPagesInSpace(rootNotionPageId, rootNotionSpaceId, getPage);

  const canonicalPageMap = Object.keys(pageMap).reduce((map, pageId: string) => {
    const recordMap = pageMap[pageId];
    if (!recordMap) {
      throw new Error(`Error loading page "${pageId}"`);
    }

    // [수정 포인트] getCanonicalPageId 대신 pageId를 직접 가공하여 사용합니다.
    // 대시(-)를 제거한 순수 32자리 UUID만 사용하여 한글 슬러그를 원천 차단합니다.
    const canonicalPageId = pageId.replace(/-/g, ''); 

    if (map[canonicalPageId]) {
      console.warn('error duplicate canonical page id', {
        canonicalPageId,
        pageId,
        existingPageId: map[canonicalPageId],
      });

      return map;
    } else {
      return {
        ...map,
        [canonicalPageId]: pageId,
      };
    }
  }, {});

  return {
    pageMap,
    canonicalPageMap,
  };
}
