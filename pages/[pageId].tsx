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
    // [개선] 노션 API 호출 시 429나 400 에러에 대비해 더 유연하게 대응합니다.
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      // 만약 노션 측 에러라면, 404를 캐싱하지 않고 짧은 시간 뒤에 재시도하도록 설정합니다.
      return { 
        props: {} as any,
        revalidate: 10,
        notFound: true 
      };
    }

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
      image = coverUrl.startsWith('http') ? coverUrl : `https://www.notion.so${coverUrl}`; 
    }

    return { 
      props: { 
        ...notionProps, 
        pageId: rawPageId, 
        recentPosts, 
        seo: { title, description, image, url: `https://aarc.kr/${rawPageId}` } 
      }, 
      revalidate: 60 
    };
  } catch (err) {
    // [중요] 에러 로그를 더 상세히 남겨 원인을 추적합니다.
    console.error(`[ARC Critical] '${rawPageId}' 로드 중단 사유:`, err.message);
    
    // 치명적 에러 시에도 1초가 아닌 10초의 여유를 두어 노션 서버의 부하를 줄입니다.
    return { notFound: true, revalidate: 10 };
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  
  const siteMap = await getSiteMap(); 
  
  const paths = Object.keys(siteMap.canonicalPageMap)
  .slice(0, 10) // 최신/중요 페이지 10개만 미리 빌드 (노션 서버 보호)
  .map((pageId) => ({
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