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
          fetchCollections: false,
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
    signFileUrls: false // ✅ 여기가 중요합니다!
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