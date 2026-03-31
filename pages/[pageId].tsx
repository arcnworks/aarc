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

    // 최신글 제외로 시스템 과부하를 원천 차단했습니다.
    const recentPosts: any[] = []; 

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
      const coverUrl = pageBlock.format.page_cover;
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
      // [타협점 1] 페이지가 성공적으로 로드되면 60초 주기로 변경 사항을 자동 갱신합니다.
      revalidate: 60 
    };
  } catch (err) {
    console.error(`[ARC Warning] '${rawPageId}' 로드 일시 중단 (재시도 대기):`, err);
    // [타협점 2] 새 글이라서 데이터를 못 찾았을 경우, 영구적인 404를 캐싱하지 않고 10초 뒤에 다시 시도하도록 지시합니다.
    return { notFound: true, revalidate: 10 };
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  
  const siteMap = await getSiteMap(); 
  
  // [타협점 3] 과부하의 원인이 제거되었으므로, 모든 페이지의 '주소록'을 빌드 시점에 정상적으로 생성합니다.
  const paths = Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
    params: { pageId }
  }));

  return { 
    paths, 
    fallback: 'blocking' // 새로 추가된 글은 클릭 시 즉시 생성됩니다.
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