import { ExtendedRecordMap } from 'notion-types';
import { parsePageId } from 'notion-utils';

import * as acl from './acl';
import { pageUrlOverrides, pageUrlAdditions, environment, site } from './config';
import { db } from './db';
import { getSiteMap } from './get-site-map';
import { getPage, GetPageOptions } from './notion';

export async function resolveNotionPage(
  domain: string,
  rawPageId?: string,
  options: GetPageOptions = {},
) {
  let pageId: string;
  let recordMap: ExtendedRecordMap;

  if (rawPageId && rawPageId !== 'index') {
    pageId = parsePageId(rawPageId);

    if (!pageId) {
      // check if the site configuration provides an override or a fallback for
      // the page's URI
      const override = pageUrlOverrides[rawPageId] || pageUrlAdditions[rawPageId];

      if (override) {
        pageId = parsePageId(override);
      }
    }

    const useUriToPageIdCache = true;
    const cacheKey = `uri-to-page-id:${domain}:${environment}:${rawPageId}`;
    const cacheTTL = undefined; // disable cache TTL

    if (!pageId && useUriToPageIdCache) {
      try {
        // check if the database has a cached mapping of this URI to page ID
        pageId = await db.get(cacheKey);
      } catch (err) {
        // ignore redis errors
        console.warn(`redis error get "${cacheKey}"`, err.message);
      }
    }

    if (pageId) {
      recordMap = await getPage(pageId, options);
    } else {
      // handle mapping of user-friendly canonical page paths to Notion page IDs
      // e.g., /developer-x-entrepreneur versus /71201624b204481f862630ea25ce62fe
      const siteMap = await getSiteMap();
      pageId = siteMap?.canonicalPageMap[rawPageId];

      if (pageId) {
        recordMap = await getPage(pageId, options);

        if (useUriToPageIdCache) {
          try {
            await db.set(cacheKey, pageId, cacheTTL);
          } catch (err) {
            console.warn(`redis error set "${cacheKey}"`, err.message);
          }
        }
      } else {
        // ✅ [핵심 수정] siteMap에 없는 페이지(토글 내부 sub-page, 데이터베이스 상세 페이지 등)를
        // rawPageId를 UUID로 직접 파싱해 Notion API로 접근 시도합니다.
        // 기존 코드는 siteMap에 없으면 무조건 404를 반환했으나,
        // 토글 내부 페이지는 siteMap에 등록되지 않으므로 이 fallback이 필수입니다.
        const directPageId = parsePageId(rawPageId);

        if (directPageId) {
          try {
            recordMap = await getPage(directPageId, options);
            pageId = directPageId;

            // 다음 접근 시 siteMap 조회를 건너뛰도록 캐시에 저장합니다.
            if (useUriToPageIdCache) {
              try {
                await db.set(cacheKey, pageId, cacheTTL);
              } catch (err) {
                console.warn(`redis error set "${cacheKey}"`, err.message);
              }
            }
          } catch (err) {
            // Notion API 자체에서 해당 pageId를 찾지 못한 경우에만 404 반환
            console.error(`[resolveNotionPage] direct getPage failed for "${rawPageId}":`, err);
            return {
              error: { message: `Not found "${rawPageId}"`, statusCode: 404 },
            };
          }
        } else {
          // UUID 파싱도 실패한 완전한 slug → 진짜 404
          return {
            error: { message: `Not found "${rawPageId}"`, statusCode: 404 },
          };
        }
      }
    }
  } else {
    pageId = site.rootNotionPageId;
    recordMap = await getPage(pageId, options);
  }

  // ✅ [수정] notion_user, space 삭제 코드 제거
  // react-notion-x 내부에서 이 필드들을 참조합니다.
  // 삭제 시 토글·체크박스·수식 등 일부 블록의 렌더링이 깨질 수 있습니다.

  const props = { site, recordMap, pageId };
  return { ...props, ...(await acl.pageAcl(props)) };
}