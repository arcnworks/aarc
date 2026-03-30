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

// [강화된 지연 함수] 2~3초의 랜덤 딜레이를 주어 429 에러 원천 차단
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// pages/[pageId].tsx 의 getStaticProps 함수 부분만 교체

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;
  
  if (!isDev) {
    const delay = Math.floor(Math.random() * 2000) + 1000;
    await sleep(delay);
  }

  try {
    // 1. 본문 데이터 로드 (여기가 가장 중요합니다)
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      console.error(`[ARC Fail] 데이터 로드 실패 (Slug: ${rawPageId})`);
      throw new Error(`Build failed for page: ${rawPageId}`);
    }

    let recentPosts = [];
    
    // 2. 최신글(사이드바) 데이터 로드 (본문과 철저히 독립된 에러 처리)
    try {
      const pageBlockId = Object.keys(notionProps.recordMap.block).find((id) => {
        const b = notionProps.recordMap.block[id]?.value;
        return b?.type === 'page';
      });

      const currentBlock = notionProps.recordMap.block[pageBlockId || '']?.value;
      const parentId = currentBlock?.parent_id;

      if (parentId) {
        // [근본적 최적화] 검색 하중을 30에서 5로 대폭 축소하여 메모리 과부하 및 타임아웃 원천 차단
        const searchResults = await search({ query: '', ancestorId: rootNotionPageId, limit: 5 });
        
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
          
          // 가져온 5개 중 최신 3개만 추출하여 화면에 표시
          recentPosts = posts.sort((a, b) => b.date - a.date).slice(0, 3);
        }
      }
    } catch (e) {
      // 사이드바 로딩에 실패하더라도 전체 페이지(500 에러)를 터뜨리지 않고 조용히 빈 배열만 넘깁니다.
      console.warn(`[ARC Sidebar Load Skipped] 과부하 방지를 위해 사이드바를 생략합니다.`);
      recentPosts = []; 
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
    if (!isDev) throw err; 
    return { notFound: true, revalidate: 5 };
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  const siteMap = await getSiteMap();
  
  // [중요] paths 배열을 빈 배열([])로 두고, fallback을 'blocking'으로 설정하면
  // Vercel이 빌드할 때 페이지를 미리 만들지 않고, 
  // 첫 방문자가 접속할 때 실시간으로 페이지를 만들어 냅니다. (과부하 방지에 탁월)
  
  return { 
    paths: [], // 기존의 Object.keys(...).map(...) 코드를 빈 배열로 변경
    fallback: 'blocking' 
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