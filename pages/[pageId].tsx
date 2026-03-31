import * as React from 'react';
import { GetStaticProps } from 'next';
import { 
  isDev, 
  domain, 
  pageUrlOverrides 
} from 'lib/config';
import { getSiteMap } from 'lib/get-site-map';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps as BasePageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '../components/Meta';
import { ExtendedRecordMap } from 'notion-types';
import { mapImageUrl } from 'lib/map-image-url';

type PageProps = BasePageProps & {
  page?: any; 
  pageId: string;
};

/**
 * [이미지 및 이모지 무결성 보호]
 */
function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  if (!recordMap || !recordMap.block) return recordMap;
  
  Object.keys(recordMap.block).forEach((key) => {
    const block = recordMap.block[key]?.value;
    if (!block) return;

    // 이모지나 노션 내부 아이콘(F0%9F... 등)은 우회 로직에서 제외하여 404 방지
    const isExternalIcon = block.format?.page_icon?.startsWith('http');

    if (block.format?.page_cover) {
      block.format.page_cover = mapImageUrl(block.format.page_cover, block as any);
    }
    
    // 외부 이미지 아이콘일 때만 처리
    if (block.format?.page_icon && isExternalIcon) {
      block.format.page_icon = mapImageUrl(block.format.page_icon, block as any);
    }

    // 블록 타입이 'image'인 경우에만 본문 소스 처리 (Tally 임베드 보호)
    if (block.type === 'image') {
      if (block.format?.display_source) {
        block.format.display_source = mapImageUrl(block.format.display_source, block as any);
      }
      if (block.properties?.source?.[0]?.[0]) {
        block.properties.source[0][0] = mapImageUrl(block.properties.source[0][0], block as any);
      }
    }
  });
  
  return recordMap;
}

/**
 * [핵심: getStaticProps] 
 * Next.js가 데이터를 가져오는 핵심 함수입니다. 반드시 export 되어야 합니다.
 */
export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;

  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      throw new Error("Notion API Data Fetch Failed");
    }

    if ('recordMap' in notionProps) {
      notionProps.recordMap = sanitizeRecordMap(notionProps.recordMap);
    }

    const recordMap = notionProps.recordMap;
    const pageBlockId = Object.keys(recordMap.block).find(
      (id) => recordMap.block[id]?.value?.type === 'page'
    );
    const pageBlock = pageBlockId ? recordMap.block[pageBlockId]?.value : undefined;

    return { 
      props: { 
        ...notionProps, 
        pageId: rawPageId,
        page: pageBlock
      }, 
      revalidate: 60 
    };
  } catch (err) {
    console.error(`[ARC ISR Error] ${rawPageId}:`, err);
    return { notFound: true, revalidate: 60 };
  }
};

/**
 * [핵심: getStaticPaths]
 * 어떤 페이지를 미리 지을지 명단을 작성합니다.
 */
export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  
  const siteMap = await getSiteMap(); 
  // 슬러그 유무와 상관없이 모든 페이지 ID를 가져옵니다.
  const allPageIds = Object.keys(siteMap.pageMap);

  const hubPages = ['index', 'blog', 'work']; 
  const top15Pages = allPageIds.slice(0, 15);

  const priorityPaths = Array.from(new Set([...hubPages, ...top15Pages]));

  const paths = priorityPaths.map((pageId) => ({
    params: { pageId }
  }));

  return { 
    paths, 
    fallback: 'blocking' 
  };
}

function generateMeta(page: any, pageId: string) {
  const title = page?.properties?.title?.[0]?.[0] || 'AaRC - Architecture and Research in Culture';
  const description = page?.properties?.['ZbRi']?.[0]?.[0] || 'AaRC(아크)는 과학적 통찰과 인문적 감수성으로 감정의 공간을 이야기 합니다.';
  const image = page?.cover?.external?.url || page?.cover?.file?.url || 'https://aarc.kr/og-image.png';
  
  let url = `https://aarc.kr/${pageId}`;
  const currentPageNotionId = page?.id?.replace(/-/g, '');

  if (pageUrlOverrides && currentPageNotionId === pageUrlOverrides.blog) {
    url = 'https://aarc.kr';
  }

  return { title, description, image, url };
}

export default function NotionDomainDynamicPage(props: PageProps) {
  const { page, pageId } = props;
  
  if (!page) return null;

  const meta = generateMeta(page, pageId);
  
  return (
    <>
      <Meta title={meta.title} description={meta.description} image={meta.image} url={meta.url} />
      <NotionPage {...props} />
    </>
  );
}