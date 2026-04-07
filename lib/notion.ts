import { ExtendedRecordMap, SearchParams, SearchResults } from 'notion-types';
import { mergeRecordMaps } from 'notion-utils';
import pMap from 'p-map';
import pMemoize from 'p-memoize';

import { isPreviewImageSupportEnabled, navigationStyle, navigationLinks } from './config';
import { notion } from './notion-api';
import { getPreviewImageMap } from './preview-images';

const getNavigationLinkPages = pMemoize(async (): Promise<ExtendedRecordMap[]> => {
  const navigationLinkPageIds = (navigationLinks || []).map(link => link.pageId).filter(Boolean);

  if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
    return pMap(
      navigationLinkPageIds,
      async navigationLinkPageId =>
        notion.getPage(navigationLinkPageId, {
          chunkLimit: 1,
          fetchMissingBlocks: false,
          fetchCollections: true,
          signFileUrls: false,
        }),
      {
        concurrency: 4,
      },
    );
  }

  return [];
});

export interface GetPageOptions {
  draftView?: boolean;
}

export async function getPage(
  pageId: string,
  options: GetPageOptions = {}
): Promise<ExtendedRecordMap> {
  let recordMap = await notion.getPage(pageId, {
    ...options,
    // --- [수정 및 추가] ---
    fetchCollections: true,     // 모든 데이터베이스 뷰 데이터를 가져옵니다.
    chunkLimit: 50,            // 한 번에 가져올 데이터 양을 늘립니다 (탭 전환 시 유리).
    fetchMissingBlocks: false,   // 누락된 블록을 보충합니다.
    signFileUrls: false 
    // -----------------------
  });

  if (navigationStyle !== 'default') {
    const navigationLinkRecordMaps = await getNavigationLinkPages();

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) => mergeRecordMaps(map, navigationLinkRecordMap),
        recordMap
      );
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap);
    (recordMap as any).preview_images = previewImageMap;
  }

  return recordMap;
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params);
}