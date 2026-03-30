import * as React from 'react';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import { 
  isDev, 
  domain, 
  description as defaultSiteDescription 
} from 'lib/config';
import { getSiteMap } from 'lib/get-site-map';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps as BasePageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import { PageBlock } from 'notion-types';
import { getBlockTitle, getPageProperty } from 'notion-utils';

// [수정 1] 문제가 되었던 defaultMapImageUrl import를 삭제했습니다.

type PageProps = BasePageProps & {
  page?: PageBlock;
  pageId: string;
  recentPosts?: Array<{ id: string; title: string; url: string; date: number }>;
  seo?: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
};

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;

  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      throw new Error(`데이터 로드 실패: ${rawPageId}`);
    }

    // 최신글 제외 (초경량화)
    const recentPosts: any[] = []; 

    // SEO 메타데이터 추출
    const recordMap = notionProps.recordMap;
    const pageBlockId = Object.keys(recordMap.block).find(
      (id) => recordMap.block[id]?.value?.type === 'page'
    );
    const pageBlock = pageBlockId ? recordMap.block[pageBlockId]?.value as PageBlock : undefined;

    const title = getBlockTitle(pageBlock, recordMap) || 'AaRC - Architecture and Research in Culture';
    
    let description = getPageProperty('Description', pageBlock, recordMap) || 
                      getPageProperty('Summary', pageBlock, recordMap) || 
                      defaultSiteDescription;
    if (typeof description !== 'string') description = defaultSiteDescription;

    // [수정 2] 복잡한 함수 호출 대신, 노션 이미지 주소를 안전하게 조립하는 방식으로 변경
    let image = 'https://aarc.kr/default-og-image.png'; 
    if (pageBlock?.format?.page_cover) {
      const coverUrl = pageBlock.format.page_cover;
      // 노션 자체 이미지인지, 외부 이미지인지에 따라 안전하게 인코딩 처리
      image = coverUrl.startsWith('http') 
        ? coverUrl 
        : `https://www.notion.so${coverUrl}`; 
    }

    const url = `https://aarc.kr/${rawPageId}`;

    return { 
      props: { 
        ...notionProps, 
        pageId: rawPageId, 
        recentPosts, 
        seo: { title, description, image, url } 
      }, 
      revalidate: 60 
    };
  } catch (err) {
    console.error(`[ARC Critical] '${rawPageId}' 로드 중단:`, err);
    return { notFound: true, revalidate: 1 };
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  const siteMap = await getSiteMap(); // 사이트맵 객체 로딩 유지 (에러 방지)
  
  // [수정 3] 429 에러의 주범인 일괄 빌드를 포기하고, 접속 시 렌더링(ISR)으로 회귀합니다.
  return { 
    paths: [], // 중요: 여기서 배열을 비워야 빌드 시 노션 서버를 때리지 않습니다.
    fallback: 'blocking' 
  };
}

export default function NotionDomainDynamicPage(props: PageProps) {
  const { seo } = props;
  
  return (
    <>
      <Head>
        <title>{seo?.title}</title>
        <meta name="description" content={seo?.description} />
        <link rel="canonical" href={seo?.url} />
        <meta property="og:title" content={seo?.title} />
        <meta property="og:description" content={seo?.description} />
        <meta property="og:url" content={seo?.url} />
        <meta property="og:image" content={seo?.image} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="AaRC" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo?.title} />
        <meta name="twitter:description" content={seo?.description} />
        <meta name="twitter:image" content={seo?.image} />
      </Head>
      <NotionPage {...props} />
    </>
  );
}