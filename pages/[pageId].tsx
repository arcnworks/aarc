import * as React from 'react';
import { GetStaticProps } from 'next';
import { isDev, domain, rootNotionPageId, pageUrlHomepageCanonical, notionPropIds, description as siteDescription } from 'lib/config';
import { getSiteMap } from 'lib/get-site-map';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps as BasePageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '~/components/Meta';
import { ExtendedRecordMap, PageBlock } from 'notion-types';
import { getPageImageUrls, getBlockTitle, getPageProperty } from 'notion-utils';
import { mapImageUrl } from 'lib/map-image-url';
import { search } from 'lib/notion';

type PageProps = BasePageProps & {
  page?: PageBlock;
  pageId: string;
  recentPosts?: Array<{ id: string; title: string; url: string; cover: string; date: number }>;
};

function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  recordMap.signed_urls = recordMap.signed_urls || {};
  getPageImageUrls(recordMap, { mapImageUrl }).forEach(() => {
    Object.entries(recordMap.block).forEach(([blockId, { value: block }]) => {
      if (!block) return;
      if (block.type === 'image') {
        const signedUrl = recordMap.signed_urls?.[blockId];
        const src = block.properties?.source?.[0]?.[0];
        if (signedUrl) recordMap.signed_urls[blockId] = mapImageUrl(signedUrl, block)!;
        else if (src) recordMap.signed_urls[blockId] = mapImageUrl(src, block)!;
        if (src) block.properties.source[0][0] = mapImageUrl(src, block)!;
      }
      const format = (block.format as any) || {};
      if (format.page_cover) format.page_cover = mapImageUrl(format.page_cover, block)!;
    });
  });
  return recordMap;
}

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;
  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    if ('recordMap' in notionProps) {
      notionProps.recordMap = sanitizeRecordMap(notionProps.recordMap);
    }

    let recentPosts = [];
    try {
      // 1. 가볍게 20개의 글만 검색 (Vercel 무료 플랜 최적화)
      const searchResults = await search({
        query: '',
        ancestorId: rootNotionPageId,
        limit: 20
      });

      const posts = [];
      if (searchResults?.recordMap?.block) {
        const blocks = Object.values(searchResults.recordMap.block);

        for (const blockContainer of blocks) {
          const block = blockContainer.value;
          if (block?.type === 'page' && block.parent_table === 'collection') {
            const id = block.id.replace(/-/g, '');
            if (id === rawPageId.replace(/-/g, '')) continue;

            const title = getBlockTitle(block, searchResults.recordMap) || '제목 없음';
            
            // --- [ARC 초정밀 수색: 원호 님의 수동 링크 우선 낚시] ---
            let manualLink = '';
            if (block.properties) {
              Object.keys(block.properties).forEach((key) => {
                const value = block.properties[key]?.[0]?.[0];
                // 속성 이름에 상관없이 http로 시작하는 주소가 들어있으면 무조건 채택
                if (typeof value === 'string' && value.startsWith('http')) {
                  manualLink = value;
                }
              });
            }

            let finalCover = manualLink;
            if (!finalCover) {
              const rawCover = block.format?.page_cover || '';
              if (rawCover) {
                const fullUrl = rawCover.startsWith('/') ? `https://www.notion.so${rawCover}` : rawCover;
                finalCover = mapImageUrl(fullUrl, block) || fullUrl;
              } else {
                finalCover = 'https://aarc.kr/default-thumbnail.png'; 
              }
            }

            posts.push({
              id,
              title,
              url: `/${id}`,
              cover: finalCover,
              date: Number(block.created_time || 0)
            });
          }
        }
      }
      // 최신순으로 상위 6개 추출
      recentPosts = posts.sort((a, b) => b.date - a.date).slice(0, 6);
      console.log(`[ARC Success] 추천 글 ${recentPosts.length}개 추출 완료`);
    } catch (searchErr) {
      console.warn('[ARC Error] 추천 글 로드 실패:', searchErr);
    }

    return { 
      props: { 
        ...notionProps, 
        pageId: rawPageId, 
        recentPosts: JSON.parse(JSON.stringify(recentPosts)) 
      }, 
      revalidate: 5 
    };
  } catch (err) {
    console.error('page error', domain, rawPageId, err);
    throw err;
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  const siteMap = await getSiteMap();
  return { 
    paths: Object.keys(siteMap.canonicalPageMap).map((pageId) => ({ params: { pageId } })), 
    fallback: true 
  };
}

function generateMeta(page: PageBlock | undefined, pageId: string) {
  const title = page?.properties?.title?.[0]?.[0] ?? '감정적인 건축가, 아크(AaRC)';
  const descriptionPropId = notionPropIds?.description;
  const description = (descriptionPropId && page?.properties?.[descriptionPropId]?.[0]?.[0]) ?? siteDescription;
  const image = page?.format?.page_cover ?? 'https://aarc.kr/og-image.png';
  let url = `https://aarc.kr/${pageId}`;
  if (pageUrlHomepageCanonical && page?.id?.replace(/-/g, '') === pageUrlHomepageCanonical) url = 'https://aarc.kr';
  return { title, description, image, url };
}

export default function NotionDomainDynamicPage(props: PageProps) {
  const { page, pageId } = props;
  const meta = generateMeta(page, pageId);
  return (
    <>
      <Meta title={meta.title} description={meta.description} image={meta.image} url={meta.url} />
      <NotionPage {...props} />
    </>
  );
}