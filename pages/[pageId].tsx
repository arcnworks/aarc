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

  // [강화 1] 출발 지연 시간을 10초로 대폭 늘려 주자 간의 간격을 벌립니다.
  if (!isDev) {
    const startDelay = Math.floor(Math.random() * 10000); 
    await new Promise(resolve => setTimeout(resolve, startDelay));
  }

  let notionProps: any;
  let retries = 5; // [강화 2] 5번까지 끈질기게 시도
  let success = false;

  while (retries > 0 && !success) {
    try {
      notionProps = await resolveNotionPage(domain, rawPageId);
      if (notionProps && !notionProps.error) {
        success = true;
      } else {
        throw new Error("Notion API Response Error");
      }
    } catch (err) {
      retries--;
      if (retries > 0) {
        // [강화 3] 재시도 대기 시간을 10초로 늘려 노션 서버의 화를 식힙니다.
        console.warn(`[ARC 병목] '${rawPageId}' 진입 실패. 10초 휴식 후 재시도... (남은 기회: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, 10000)); 
      }
    }
  }

  // 5번의 시도 끝에도 실패하면, 404를 굽지 않고 빌드 에러를 내어 '이전의 정상 상태'를 보호합니다.
  if (!success) {
    throw new Error(`[ARC 치명적] 페이지 빌드 최종 실패 (노션 서버 차단): ${rawPageId}`);
  }

  // 이후 이미지 우회(sanitizeRecordMap) 및 메타데이터 로직은 동일하게 유지...
  if (notionProps && 'recordMap' in notionProps) {
    notionProps.recordMap = sanitizeRecordMap(notionProps.recordMap);
  }
  
  // (중략 - 이전 코드의 나머지 부분 유지)
  const recordMap = notionProps.recordMap;
  const pageBlockId = Object.keys(recordMap.block).find(id => recordMap.block[id]?.value?.type === 'page');
  const pageBlock = pageBlockId ? recordMap.block[pageBlockId]?.value : undefined;

  return { 
    props: { ...notionProps, pageId: rawPageId, page: pageBlock }, 
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