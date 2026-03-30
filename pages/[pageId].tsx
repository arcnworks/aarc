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

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;
  
  // [핵심 변경] 빌드 모드일 때만 강력한 대기 시간을 적용합니다.
  if (!isDev) {
    const delay = Math.floor(Math.random() * 2000) + 1000; // 1~3초 랜덤 대기
    await sleep(delay);
  }

  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      console.error(`[ARC Fail] 데이터 로드 실패 (Slug: ${rawPageId})`);
      throw new Error(`Build failed for page: ${rawPageId} due to API issues.`);
    }

    let recentPosts = [];
    try {
      // (최신글 로직은 기존과 완전히 동일하게 유지합니다)
      const pageBlockId = Object.keys(notionProps.recordMap.block).find((id) => {
        const b = notionProps.recordMap.block[id]?.value;
        return b?.type === 'page';
      });

      const currentBlock = notionProps.recordMap.block[pageBlockId || '']?.value;
      const parentId = currentBlock?.parent_id;

      if (parentId) {
        // [주의] 최근 글 검색에서도 과부하가 걸릴 수 있으므로 limit을 30으로 약간 줄였습니다.
        const searchResults = await search({ query: '', ancestorId: rootNotionPageId, limit: 30 });
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
    if (!isDev) throw err; // 여기서 에러를 던져야 Vercel이 404로 덮어쓰지 않습니다.
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