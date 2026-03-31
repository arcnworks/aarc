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
 * [이미지 보안 우회] 400 Bad Request를 원천 차단합니다.
 */
function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  if (!recordMap || !recordMap.block) return recordMap;
  
  Object.keys(recordMap.block).forEach((key) => {
    const block = recordMap.block[key]?.value;
    if (!block) return;

    if (block.format?.display_source) {
      block.format.display_source = mapImageUrl(block.format.display_source, block as any);
    }
    if (block.format?.page_cover) {
      block.format.page_cover = mapImageUrl(block.format.page_cover, block as any);
    }
    if (block.properties?.source?.[0]?.[0]) {
      block.properties.source[0][0] = mapImageUrl(block.properties.source[0][0], block as any);
    }
  });
  
  return recordMap;
}

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;

  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      throw new Error("Notion API Data Fetch Failed");
    }

    // 이미지 경로 치환 (400 에러 방지)
    if ('recordMap' in notionProps) {
      notionProps.recordMap = sanitizeRecordMap(notionProps.recordMap);
    }

    const recordMap = notionProps.recordMap;
    const pageBlockId = Object.keys(recordMap.block).find(
      (id) => recordMap.block[id]?.value?.type === 'page'
    );
    const pageBlock = pageBlockId ? recordMap.block[pageBlockId]?.value : undefined;

    const props: PageProps = { 
      ...notionProps, 
      pageId: rawPageId,
      page: pageBlock
    };

    return { 
      props, 
      revalidate: 10 // [핵심] 원호 님의 요청대로 10초마다 최신 정보를 체크합니다.
    };
  } catch (err) {
    console.error(`[ARC ISR 에러] '${rawPageId}' 로드 실패:`, err);
    
    // 실패 시 404를 캐싱하지 않고, 10초 뒤에 다시 시도하도록 설정합니다.
    return { 
      notFound: true, 
      revalidate: 10 
    };
  }
};

export async function getStaticPaths() {
  /**
   * [ISR의 핵심 전략]
   * 빌드 시점에 어떤 페이지도 미리 만들지 않습니다. (paths: [])
   * 이로써 빌드 단계에서 발생하는 429 에러를 100% 원천 차단합니다.
   */
  return { 
    paths: [], 
    fallback: 'blocking' // 사용자가 클릭하는 순간 서버에서 실시간으로 생성합니다.
  };
}

// 메타 정보 생성 로직 (이전과 동일)
function generateMeta(page: any, pageId: string) {
  const title = page?.properties?.title?.[0]?.[0] || 'AaRC - Architecture and Research in Culture';
  const description = page?.properties?.['ZbRi']?.[0]?.[0] || 'AaRC(아크)는 과학적 통찰과 인문적 감수성을 바탕으로 감정의 공간을 이야기 합니다.';
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
  
  // 데이터 로딩 중일 때 (fallback: 'blocking'이므로 드물게 발생)
  if (!page) return null;

  const meta = generateMeta(page, pageId);
  
  return (
    <>
      <Meta 
        title={meta.title} 
        description={meta.description} 
        image={meta.image} 
        url={meta.url} 
      />
      <NotionPage {...props} />
    </>
  );
}