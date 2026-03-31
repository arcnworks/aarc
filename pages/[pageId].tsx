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
 * [하이브리드 핵심 1: 과거의 유산 복구]
 * recordMap 내부 모든 이미지 URL을 mapImageUrl로 치환해 줍니다.
 * 이렇게 하면 노션에 무리한 서명 요청을 하지 않아 400 Bad Request 에러를 완벽히 차단합니다.
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

  // [하이브리드 핵심 2: 병목 통제] Vercel이 모든 페이지를 동시에 렌더링하여 발생하는 429 에러 방어
  if (!isDev) {
    const startDelay = Math.floor(Math.random() * 3000);
    await new Promise(resolve => setTimeout(resolve, startDelay));
  }

  let notionProps: any;
  let retries = 3; 
  let success = false;

  // [하이브리드 핵심 3: 3전 4기 시스템] 에러 발생 시 포기(404)하지 않고 5초 대기 후 재진입
  while (retries > 0 && !success) {
    try {
      notionProps = await resolveNotionPage(domain, rawPageId);
      
      if (!notionProps || notionProps.error) {
        throw new Error("Notion API Data Error");
      }
      
      success = true; 
    } catch (err) {
      retries--;
      if (retries > 0) {
        console.warn(`[ARC 재시도] '${rawPageId}' 병목 발생. 5초 대기 후 재진입합니다. (남은 횟수: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error(`[ARC 치명적 오류] '${rawPageId}' 데이터 수신 최종 실패`);
      }
    }
  }

  // 404 폭증을 막기 위해, 실패 시 notFound를 반환하지 않고 시스템 에러를 던져 과거의 정상 화면을 보호합니다.
  if (!success) {
    throw new Error(`페이지 로드 실패 - 재시도 횟수 초과: ${rawPageId}`);
  }

  // 데이터 치환 (400 에러 방어)
  if (notionProps && 'recordMap' in notionProps) {
    notionProps.recordMap = sanitizeRecordMap(notionProps.recordMap);
  }

  // 페이지 블록 추출 (SEO 메타데이터용)
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
    revalidate: 60 
  };
};

export async function getStaticPaths() {
  if (isDev) return { paths: [], fallback: true };
  
  const siteMap = await getSiteMap(); 
  
  // [완벽한 사용자 경험] 10개 제한을 풀고, 원호 님의 뜻대로 모든 페이지를 한 번에 빌드합니다.
  const paths = Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
    params: { pageId }
  }));

  return { 
    paths, 
    fallback: 'blocking' 
  };
}

// 예전 코드의 메타 정보 자동 생성 함수 복원
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