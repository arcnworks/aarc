import * as React from 'react';
import { GetStaticProps } from 'next';
import Script from 'next/script'; 
import { 
  isDev, 
  domain, 
  pageUrlOverrides 
} from 'lib/config';
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
 * [무결성 이미지 보안 우회 - 이모지 예외 처리 적용] 
 * 블록의 'Type'을 기준으로 이미지(image)만 골라내어 처리합니다.
 * Tally, YouTube 등 임베드 블록은 건드리지 않아 데이터 깨짐을 원천 차단합니다.
 */
function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  if (!recordMap || !recordMap.block) return recordMap;
  
  Object.keys(recordMap.block).forEach((key) => {
    const block = recordMap.block[key]?.value;
    if (!block) return;

    // [핵심] URL인지 판별하는 헬퍼 함수 (이모지가 이미지 URL 변환기에 들어가 404 에러를 내는 것을 방지)
    const isUrl = (str: string) => str && (str.startsWith('http') || str.startsWith('/'));

    // 1. 공통 이미지 요소 (커버, 아이콘) 처리
    if (block.format?.page_cover && isUrl(block.format.page_cover)) {
      block.format.page_cover = mapImageUrl(block.format.page_cover, block as any);
    }
    if (block.format?.page_icon && isUrl(block.format.page_icon)) {
      block.format.page_icon = mapImageUrl(block.format.page_icon, block as any);
    }

    // 2. 블록 타입이 'image'인 경우에만 본문 소스 처리
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
  // 한글 슬러그를 포기했으므로, 전달되는 pageId는 영문/숫자 조합의 Notion 고유 ID입니다.
  // 서버가 오작동을 일으키던 디코딩(decodeURIComponent) 로직을 완전히 제거하여 속도를 높였습니다.
  const rawPageId = context.params!.pageId as string;

  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    
    if (!notionProps || (notionProps as any).error) {
      throw new Error(`Notion API Fetch Error for page: ${rawPageId}`);
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
      revalidate: 60 // 1분마다 최신 데이터를 체크하여 백그라운드에서 조용히 갱신합니다.
    };
  } catch (err) {
    console.error(`[ARC ISR Error] ${rawPageId}:`, err);
    // 고유 ID 라우팅 구조에서는 매칭 에러가 날 확률이 극히 적으므로, 
    // Notion API 일시 장애 시 기존 정상 화면을 띄워주는 throw err 방어막을 그대로 유지합니다.
    throw err; 
  }
};

export async function getStaticPaths() {
  // 전략적 전진 배치(미리 빌드)가 전혀 필요 없는 가장 가벼운 100% ISR 세팅입니다.
  return { 
    paths: [], 
    fallback: 'blocking' // 고유 ID를 직접 찌르므로 서버 렌더링(블로킹) 딜레이가 최소화됩니다.
  };
}

function generateMeta(page: any, pageId: string) {
  const title = page?.properties?.title?.[0]?.[0] || 'ARC - Architecture and Research in Cultures';
  const description = page?.properties?.['ZbRi']?.[0]?.[0] || 'ARC(아크)는 과학적 통찰과 인문적 감수성으로 감정의 공간을 이야기 합니다.';
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
      
      {/* Tally 임베드 스크립트 안전 로드 */}
      <Script 
        src="https://tally.so/widgets/embed.js" 
        strategy="lazyOnload" 
      />
      
      <NotionPage {...props} />
    </>
  );
}