import * as React from 'react';
import { GetStaticProps } from 'next';
import Script from 'next/script'; // Tally 임베드 스크립트 로드를 위해 추가
import { 
  isDev, 
  domain, 
  pageUrlOverrides 
} from 'lib/config';
// 미리 빌드를 위한 getSiteMap 임포트 제거
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
    // [핵심 변경 사항] 
    // 기존 return { notFound: true } 대신 throw err를 사용하여 
    // Notion API에서 400 에러가 발생하더라도 기존에 캐싱된(Stale) 정상 페이지를 계속 보여줍니다.
    throw err; 
  }
};

export async function getStaticPaths() {
  // [핵심 변경 사항] 전략적 전진 배치(미리 빌드) 로직을 모두 제거했습니다.
  // 빌드 타임에는 아무 페이지도 생성하지 않으며, 모든 페이지는 완전한 ISR로 동작합니다.
  return { 
    paths: [], 
    fallback: 'blocking' // 누군가 최초로 접속할 때 서버에서 즉시 빌드 후 캐싱합니다.
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
      
      {/* [Tally 임베드 스크립트 안전 로드]
        lazyOnload를 통해 React의 렌더링이 완전히 끝난 후 스크립트를 실행하여 
        정적 생성(ISR) 화면과 Tally iframe 간의 충돌을 방지합니다. 
      */}
      <Script 
        src="https://tally.so/widgets/embed.js" 
        strategy="lazyOnload" 
      />
      
      <NotionPage {...props} />
    </>
  );
}