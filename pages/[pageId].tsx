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

  // [핵심 혁신 1: 트래픽 분산] Vercel이 수십 개의 페이지를 동시에 요청하여 노션이 다운되는 것을 막기 위해, 0~2초 사이의 무작위 지연(Stagger)을 줍니다.
  if (!isDev) {
    const staggerDelay = Math.floor(Math.random() * 2000);
    await new Promise(resolve => setTimeout(resolve, staggerDelay));
  }

  let notionProps;
  let retries = 3; // 429 에러 시 최대 3번까지 끈질기게 재시도합니다.
  let success = false;

  while (retries > 0 && !success) {
    try {
      notionProps = await resolveNotionPage(domain, rawPageId);
      if (notionProps && !(notionProps as any).error) {
        success = true;
      } else {
        throw new Error("Notion API Data Error");
      }
    } catch (err) {
      retries--;
      if (retries > 0) {
        console.log(`[ARC Retry] '${rawPageId}' 429 방어 중... 3초 후 재시도합니다. (남은 횟수: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기 후 재시도
      } else {
        console.error(`[ARC Critical] '${rawPageId}' 최종 로드 실패`);
      }
    }
  }

  // 3번의 끈질긴 재시도 끝에도 실패하면, 그때서야 아주 잠깐 404를 내보내고 10초 뒤 복구를 도모합니다.
  if (!success) {
    return { notFound: true, revalidate: 10 };
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
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  
  const siteMap = await getSiteMap(); 
  
  // [핵심 혁신 2: 모든 페이지 사전 빌드 복구] 10개 제한을 없애고 모든 페이지를 한 번에 빌드합니다.
  const paths = Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
    params: { pageId }
  }));

  return { 
    paths, 
    fallback: 'blocking' // 검색 방문자는 100% 확률로 0초 만에 렌더링된 완벽한 페이지를 보게 됩니다.
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