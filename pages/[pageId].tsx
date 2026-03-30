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

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;
  
  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error || !('recordMap' in notionProps)) {
      return { notFound: true, revalidate: 60 };
    }

    let recentPosts = [];
    try {
      // [개선] 주소창의 이름(Slug) 대신, 실제 로드된 페이지 데이터에서 메인 블록 ID를 찾습니다.
      const pageBlockId = Object.keys(notionProps.recordMap.block).find((id) => {
        const b = notionProps.recordMap.block[id]?.value;
        return b?.type === 'page';
      });

      const currentBlock = notionProps.recordMap.block[pageBlockId || '']?.value;
      const parentId = currentBlock?.parent_id;

      console.log(`[ARC Debug] 현재 페이지 ID: ${pageBlockId}, 부모 ID: ${parentId}`);

      if (parentId) {
        // 검색 범위를 40개로 넓혀서 더 안정적으로 수집합니다.
        const searchResults = await search({ query: '', ancestorId: rootNotionPageId, limit: 40 });
        
        if (searchResults?.recordMap?.block) {
          const posts = [];
          const blocks = Object.values(searchResults.recordMap.block);

          for (const blockContainer of blocks) {
            const block = blockContainer.value;
            
            // 부모 ID가 같고, 현재 보고 있는 페이지가 아닌 것들만 필터링
            if (block?.type === 'page' && block.parent_id === parentId) {
              if (block.id === pageBlockId) continue;

              posts.push({
                id: block.id.replace(/-/g, ''),
                title: getBlockTitle(block, searchResults.recordMap) || '제목 없음',
                url: `/${block.id.replace(/-/g, '')}`,
                date: Number(block.created_time || 0)
              });
            }
          }
          
          recentPosts = posts.sort((a, b) => b.date - a.date).slice(0, 6);
          console.log(`[ARC Success] "${rawPageId}" 페이지에 추천 글 ${recentPosts.length}개 로드 완료`);
        }
      } else {
        console.warn(`[ARC Warning] "${rawPageId}" 페이지의 부모(Database)를 찾을 수 없습니다.`);
      }
    } catch (searchErr) {
      console.warn(`[ARC Error] 최신글 로직 실행 중 오류:`, searchErr);
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
    console.error(`[ARC Critical] 페이지 데이터 로드 실패:`, err);
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