import * as React from 'react';
import { GetStaticProps } from 'next';
import Script from 'next/script'; 
import { domain, pageUrlOverrides } from 'lib/config';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps as BasePageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '../components/Meta';
import { ExtendedRecordMap } from 'notion-types';
import { mapImageUrl } from 'lib/map-image-url';

type PageProps = BasePageProps & {
  page?: any; 
  pageId: string;
  meta?: any;
};

// 노션 이미지 주소를 최적화 경로로 매핑
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

    // ✅ [수정] notion_user, space 삭제 코드 제거
    // react-notion-x가 내부적으로 이 필드들을 참조합니다.
    // 삭제 시 토글·체크박스·수식 등 블록 렌더링이 깨질 수 있습니다.
    // 용량 절감이 필요하다면 revalidate 주기(현재 86400초)로 대응하세요.
    
    let pageBlockId = Object.keys(recordMap.block).find(
      (id) => recordMap.block[id]?.value?.type === 'page'
    );
    
    if (!pageBlockId && recordMap.block) {
      pageBlockId = Object.keys(recordMap.block)[0];
    }

    const pageBlock = pageBlockId ? recordMap.block[pageBlockId]?.value : null;

    // ✅ SEO 최적화를 위한 메타데이터 생성
    const meta = generateMeta(pageBlock, rawPageId);

    return { 
      props: JSON.parse(JSON.stringify({ 
        ...notionProps, 
        pageId: rawPageId,
        page: pageBlock || null,
        meta 
      })), 
      revalidate: 600 // 24시간(86400초) 주기: Vercel ISR Writes 절감
    };
  } catch (err) {
    console.error(`[ARC ISR Error] ${rawPageId}:`, err);
    return { notFound: true };
  }
};

// 뼈대 없이 완벽한 렌더링 후 제공 (구글 SEO 검색 노출 최적화)
export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' };
}

// SEO 데이터(제목, 설명, 썸네일) 생성 함수
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
  const { recordMap } = props;

  if (!recordMap) return null;

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