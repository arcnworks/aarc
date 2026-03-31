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
 * [무결성 이미지 보안 우회] 
 * 블록의 'Type'을 기준으로 이미지(image)만 골라내어 처리합니다.
 * Tally, YouTube 등 임베드 블록은 건드리지 않아 데이터 깨짐을 원천 차단합니다.
 */
function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  if (!recordMap || !recordMap.block) return recordMap;
  
  Object.keys(recordMap.block).forEach((key) => {
    const block = recordMap.block[key]?.value;
    if (!block) return;

    // 1. 공통 이미지 요소 (커버, 아이콘) 처리
    if (block.format?.page_cover) {
      block.format.page_cover = mapImageUrl(block.format.page_cover, block as any);
    }
    if (block.format?.page_icon) {
      block.format.page_icon = mapImageUrl(block.format.page_icon, block as any);
    }

    // 2. 블록 타입이 'image'인 경우에만 본문 소스 처리
    // Tally(embed), Video 등 다른 타입은 이 로직을 타지 않아 안전하게 보존됩니다.
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

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;

  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      throw new Error("Notion API Fetch Error");
    }

    // 이미지 및 임베드 무결성 로직 적용
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
      revalidate: 60 // 1분마다 최신 데이터를 체크하여 갱신합니다.
    };
  } catch (err) {
    console.error(`[ARC ISR Error] ${rawPageId}:`, err);
    return { notFound: true, revalidate: 60 };
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  
  const siteMap = await getSiteMap(); 
  const allPageIds = Object.keys(siteMap.canonicalPageMap);

  // 1. 확실한 허브 페이지들
  const hubPages = ['index', 'blog', 'work']; 
  
  // 2. 주소에 상관없이 최신/상위 15개 페이지를 무조건 미리 빌드합니다.
  // 이렇게 하면 블로그와 워크의 최신글들이 자연스럽게 포함됩니다.
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
  const description = page?.properties?.['ZbRi']?.[0]?.[0] || 'AaRC(아크)는 과학적 통찰과 인문적 감수성으로 공간의 감정을 이야기 합니다.';
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