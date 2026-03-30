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
import { defaultMapImageUrl } from 'lib/map-image-url';

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
    // 1. 본문 데이터 로드
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      throw new Error(`데이터 로드 실패: ${rawPageId}`);
    }

    // 2. 무거운 최신글 검색 제외 (초경량화)
    const recentPosts: any[] = []; 

    // 3. SEO 메타데이터 추출
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

    let image = 'https://aarc.kr/default-og-image.png'; 
    if (pageBlock?.format?.page_cover) {
      image = defaultMapImageUrl(pageBlock.format.page_cover, pageBlock);
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
  const siteMap = await getSiteMap();
  
  // 4. ISR 적용: 페이지를 미리 만들어두어 과부하 방지
  return { 
    paths: Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
      params: { pageId }
    })), 
    fallback: 'blocking' 
  };
}

export default function NotionDomainDynamicPage(props: PageProps) {
  const { seo } = props;
  
  // 5. HTML <head> 태그에 메타데이터 주입
  return (
    <>
      <Head>
        {/* 기본 SEO */}
        <title>{seo?.title}</title>
        <meta name="description" content={seo?.description} />
        <link rel="canonical" href={seo?.url} />

        {/* 오픈 그래프 (SNS 공유용) */}
        <meta property="og:title" content={seo?.title} />
        <meta property="og:description" content={seo?.description} />
        <meta property="og:url" content={seo?.url} />
        <meta property="og:image" content={seo?.image} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="AaRC" />

        {/* 트위터 카드 */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo?.title} />
        <meta name="twitter:description" content={seo?.description} />
        <meta name="twitter:image" content={seo?.image} />
      </Head>
      <NotionPage {...props} />
    </>
  );
}