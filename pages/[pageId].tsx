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
 * [이미지 보안 우회] 노션 서버에 서명을 요청하지 않고 이미지를 출력하여 400 에러를 원천 차단합니다.
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
      throw new Error("Notion API Fetch Error");
    }

    // 이미지 경로 치환 로직 실행
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
      revalidate: 60 // 60초마다 백그라운드에서 최신 데이터를 체크합니다.
    };
  } catch (err) {
    console.error(`[ARC ISR] '${rawPageId}' 데이터 수신 중 지연 발생:`, err);
    // 에러 발생 시 404를 반환하되, 60초 뒤에 다시 시도하도록 설정
    return { notFound: true, revalidate: 60 };
  }
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  
  const siteMap = await getSiteMap(); 
  const allPageIds = Object.keys(siteMap.canonicalPageMap);

  /**
   * [전략적 전진 배치 명단 설계]
   */
  // 1. 고정 핵심 페이지
  const hubPages = ['index', 'blog', 'work']; 
  
  // 2. 블로그 최신글 5개 (URL에 'blog'가 포함된 페이지 중 상위 5개)
  const latestBlogPosts = allPageIds
    .filter(id => id.toLowerCase().includes('blog'))
    .slice(0, 5);
    
  // 3. 워크 최신 프로젝트 5개 (URL에 'work'가 포함된 페이지 중 상위 5개)
  const latestWorkPosts = allPageIds
    .filter(id => id.toLowerCase().includes('work'))
    .slice(0, 5);

  // 명단 합치기 및 중복 제거
  const priorityPaths = Array.from(new Set([...hubPages, ...latestBlogPosts, ...latestWorkPosts]));

  const paths = priorityPaths.map((pageId) => ({
    params: { pageId }
  }));

  return { 
    paths, 
    fallback: 'blocking' // 명단에 없는 페이지는 접속 즉시 서버에서 조립합니다.
  };
}

// SEO 메타데이터 생성 함수
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
  
  // ISR 처리 중 데이터가 없을 때의 방어 로직
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