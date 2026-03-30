// pages/[pageId].tsx

import * as React from 'react';
import { GetStaticProps } from 'next';
import { isDev, domain, rootNotionPageId, pageUrlHomepageCanonical, notionPropIds, description as siteDescription } from 'lib/config';
import { getSiteMap } from 'lib/get-site-map';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps as BasePageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '~/components/Meta';
import { ExtendedRecordMap, PageBlock } from 'notion-types';
import { getBlockTitle } from 'notion-utils';
import { search } from 'lib/notion';

type PageProps = BasePageProps & {
  page?: PageBlock;
  pageId: string;
  recentPosts?: Array<{ id: string; title: string; url: string; date: number }>;
};

// pages/[pageId].tsx

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string; // 주소창의 슬러그(예: 'blog')를 가져옴

  try {
    // 1. 슬러그를 통해 노션 데이터를 불러옵니다.
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    // [핵심 수정] 에러가 발생하거나 데이터가 없으면 'notFound'를 주지 말고 에러를 던집니다.
    // 이렇게 해야 Vercel 빌드가 실패하고, 깨진 사이트가 배포되는 것을 막습니다.
    if (!notionProps || (notionProps as any).error) {
      console.error(`[ARC Fail] 데이터 로드 실패 (Slug: ${rawPageId})`);
      throw new Error(`Build failed for page: ${rawPageId} due to API issues.`);
    }

    // 2. 최근 글(recentPosts) 추출 로직 (안정성을 위해 내부 try-catch 유지)
    let recentPosts = [];
    try {
      // 페이지의 실제 UUID를 찾아 부모 ID를 추적합니다.
      const pageBlockId = Object.keys(notionProps.recordMap.block).find((id) => {
        const b = notionProps.recordMap.block[id]?.value;
        return b?.type === 'page';
      });

      const currentBlock = notionProps.recordMap.block[pageBlockId || '']?.value;
      const parentId = currentBlock?.parent_id;

      if (parentId) {
        const searchResults = await search({ query: '', ancestorId: rootNotionPageId, limit: 40 });
        if (searchResults?.recordMap?.block) {
          const blocks = Object.values(searchResults.recordMap.block);
          const posts = blocks
            .filter(b => b.value?.type === 'page' && b.value.parent_id === parentId && b.value.id !== pageBlockId)
            .map(b => ({
              id: b.value.id.replace(/-/g, ''),
              title: getBlockTitle(b.value, searchResults.recordMap) || '제목 없음',
              url: `/${b.value.id.replace(/-/g, '')}`,
              date: Number(b.value.created_time || 0)
            }));
          recentPosts = posts.sort((a, b) => b.date - a.date).slice(0, 6);
        }
      }
    } catch (e) {
      console.warn(`[ARC Sidebar Warning] 사이드바 데이터를 가져오지 못했습니다.`);
    }

    return { 
      props: { 
        ...notionProps, 
        pageId: rawPageId, 
        recentPosts: JSON.parse(JSON.stringify(recentPosts)) 
      }, 
      revalidate: 60 
    };
  } catch (err) {
    console.error(`[ARC Critical] '${rawPageId}' 빌드 중단:`, err);
    // 빌드 중에는 실패하게 만들고, 배포 후 운영 중(ISR)에만 404를 허용합니다.
    if (!isDev) throw err; 
    return { notFound: true, revalidate: 5 };
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  const siteMap = await getSiteMap();
  return { 
    paths: Object.keys(siteMap.canonicalPageMap).map((pageId) => ({ params: { pageId } })), 
    fallback: 'blocking' // fallback: true 대신 'blocking' 사용으로 안정성 강화
  };
}

export default function NotionDomainDynamicPage(props: PageProps) {
  const { page, pageId } = props;
  const title = page?.properties?.title?.[0]?.[0] ?? 'ARC';
  return (
    <>
      <Meta title={title} description={siteDescription} url={`https://aarc.kr/${pageId}`} />
      <NotionPage {...props} />
    </>
  );
}