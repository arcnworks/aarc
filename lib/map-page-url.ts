import { ExtendedRecordMap } from 'notion-types';
import { uuidToId, parsePageId } from 'notion-utils';

import { Site } from './types';
import { includeNotionIdInUrls } from './config';
import { getCanonicalPageId } from './get-canonical-page-id';

// include UUIDs in page URLs during local development but not in production
// (they're nice for debugging and speed up local dev)
const uuid = !!includeNotionIdInUrls;

export const mapPageUrl =
  (site: Site, recordMap: ExtendedRecordMap, searchParams: URLSearchParams, draftView: boolean) =>
  (pageId = '') => {
    const pageUuid = parsePageId(pageId, { uuid: true });

    // [추가된 안전장치 1] 가져온 페이지 ID가 비어있으면 무시합니다.
    if (!pageUuid) return '';

    if (uuidToId(pageUuid) === site.rootNotionPageId) {
      return createUrl('/', searchParams);
    } else {
      return createUrl(
        `/${getCanonicalPageId(pageUuid, recordMap, { uuid: draftView ? true : uuid })}`,
        searchParams,
      );
    }
  };

export const getCanonicalPageUrl =
  (site: Site, recordMap: ExtendedRecordMap) =>
  (pageId = '') => {
    const pageUuid = parsePageId(pageId, { uuid: true });

    // [추가된 안전장치 2] 가져온 페이지 ID가 비어있으면 무시합니다.
    if (!pageId || !pageUuid) return '';

    if (uuidToId(pageId) === site.rootNotionPageId) {
      return `https://${site.domain}`;
    } else {
      return `https://${site.domain}/${getCanonicalPageId(pageUuid, recordMap, {
        uuid,
      })}`;
    }
  };

function createUrl(path: string, searchParams: URLSearchParams) {
  return [path, searchParams.toString()].filter(Boolean).join('?');
}