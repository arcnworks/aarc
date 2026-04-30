import * as React from 'react';
import { GetStaticProps } from 'next';
import Script from 'next/script'; 
import { useRouter } from 'next/router';
import { isDev, domain, pageUrlOverrides } from 'lib/config';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps as BasePageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '../components/Meta';
import { ExtendedRecordMap } from 'notion-types';
import { mapImageUrl } from 'lib/map-image-url';

type PageProps = BasePageProps & {
  page?: any; 
  pageId: string;
  meta?: any; // meta 타입 추가
};

function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  if (!recordMap || !recordMap.block) return recordMap;
  Object.keys(recordMap.block).forEach((key) => {
    const block = recordMap.block[key]?.value;
    if (!block) return;
    const isUrl = (str: string) => str && (str.startsWith('http') || str.startsWith('/'));
    if (block.format?.page_cover && isUrl(block.format.page_cover)) block.format.page_cover = mapImageUrl(block.format.page_cover, block as any);
    if (block.format?.page_icon && isUrl(block.format.page_icon)) block.format.page_icon = mapImageUrl(block.format.page_icon, block as any);
    if (block.type === 'image') {
      if (block.format?.display_source) block.format.display_source = mapImageUrl(block.format.display_source, block as any);
      if (block.properties?.source?.[0]?.[0]) block.properties.source[0][0] = mapImageUrl(block.properties.source[0][0], block as any);
    }
  });
  return recordMap;
}

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string;

  try {
    const notionProps = await resolveNotionPage(domain, rawPageId);
    if (!notionProps || (notionProps as any).error) return { notFound: true };

    if ('recordMap' in notionProps) {
      notionProps.recordMap = sanitizeRecordMap(notionProps.recordMap);
    }

    const recordMap = notionProps.recordMap;

    // 💡 [AaRC 안전 경량화 엔진] 데이터 유실 없이 최소한의 정리만 수행합니다.
    if (recordMap) {
      // 1. 유저 정보 삭제 (페이지 로드에 영향 없음)
      if (recordMap.notion_user) delete recordMap.notion_user;
      // 2. 워크스페이스 정보 삭제 (페이지 로드에 영향 없음)
      if (recordMap.space) delete recordMap.space;
    }
    
    // 메인 페이지 블록 찾기
    let pageBlockId = Object.keys(recordMap.block).find(
      (id) => recordMap.block[id]?.value?.type === 'page'
    );
    
    if (!pageBlockId && recordMap.block) {
      pageBlockId = Object.keys(recordMap.block)[0];
    }

    const pageBlock = pageBlockId ? recordMap.block[pageBlockId]?.value : null;

    // ✅ SEO 메타 데이터 생성 (generateMeta 함수 호출)
    const meta = generateMeta(pageBlock, rawPageId);

    return { 
      props: JSON.parse(JSON.stringify({ 
        ...notionProps, 
        pageId: rawPageId,
        page: pageBlock || null,
        meta // ✅ 생성된 메타 데이터를 props에 추가하여 전달
      })), 
      revalidate: 86400 
    };
  } catch (err) {
    console.error(`[ARC ISR Error] ${rawPageId}:`, err);
    return { notFound: true };
  }
};

export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' };
}

// 이 함수는 getStaticProps 내부에서 호출되어 SEO 데이터를 만듭니다.
function generateMeta(page: any, pageId: string) {
  const title = page?.properties?.title?.[0]?.[0] || 'ARC - Architecture and Research in Cultures';
  const description = page?.properties?.['ZbRi']?.[0]?.[0] || 'ARC(아크)는 과학적 통찰과 인문적 감수성으로 감정의 공간을 이야기 합니다.';
  const image = page?.cover?.external?.url || page?.cover?.file?.url || 'https://aarc.kr/og-image.png';
  
  let url = `https://aarc.kr/${pageId}`;
  const currentPageNotionId = page?.id?.replace(/-/g, '');
  if (pageUrlOverrides && currentPageNotionId === pageUrlOverrides.blog) url = 'https://aarc.kr';

  return { title, description, image, url };
}

export default function NotionDomainDynamicPage(props: PageProps) {
  const { page, pageId, recordMap } = props;
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. 히스토리 생성 원천 가드
    const originalPushState = window.history.pushState;
    window.history.pushState = function (state, title, url) {
      const currentPath = window.location.pathname;
      const targetUrl = url ? url.toString() : '';

      const isAnalytics = targetUrl.includes('gtm.js') || targetUrl.includes('google-analytics');
      const isDuplicate = targetUrl === currentPath || (pageId && targetUrl.includes(pageId));

      if (isAnalytics || isDuplicate) {
        return window.history.replaceState(state, title, url);
      }
      return originalPushState.apply(this, [state, title, url]);
    };

    // 2. 라우터 스택 가드
    router.beforePopState(({ as }) => {
      if (as === router.asPath) {
        window.history.back();
        return false;
      }
      return true;
    });

    return () => {
      window.history.pushState = originalPushState;
      router.beforePopState(() => true);
    };
  }, [pageId, router]);

  if (!recordMap) return null;

  // ✅ getStaticProps에서 넘어온 meta 데이터를 받아 사용합니다.
  const meta = (props as any).meta || { title: '', description: '', image: '', url: '' };

  return (
    <>
      <Meta title={meta.title} description={meta.description} image={meta.image} url={meta.url} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=G-D4L1068X6F`}
        strategy="afterInteractive"
      />
      <NotionPage {...props} />
    </>
  );
}