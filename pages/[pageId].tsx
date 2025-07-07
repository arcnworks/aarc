// pages/[pageId].tsx

import * as React from 'react';
import { GetStaticProps } from 'next';
import { isDev, domain } from 'lib/config';
import { getSiteMap } from 'lib/get-site-map';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps as BasePageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '~/components/Meta'; // '~'는 루트 디렉토리를 가리키는 별칭입니다.
import {
  pageUrlHomepageCanonical,
  notionPropIds,
  description as siteDescription,
} from 'lib/config';
import { ExtendedRecordMap, PageBlock } from 'notion-types';
import { getPageImageUrls } from 'notion-utils';
import { mapImageUrl } from 'lib/map-image-url';

/**
 * Notion 페이지 데이터와 페이지 slug를 포함하는 페이지 컴포넌트의 props 타입입니다.
 */
type PageProps = BasePageProps & {
  /**
   * Notion 페이지 객체.
   * PageBlock 타입으로 지정하여 타입 안정성을 높입니다.
   * Notion API의 복잡성으로 인해 모든 속성을 완벽히 타이핑하기는 어려우나,
   * 주요 속성에 대한 자동 완성과 타입 체크가 가능해집니다.
   */
  page?: PageBlock;
  pageId: string;
};
/**
 * recordMap 내부 모든 이미지 URL을 mapImageUrl로 치환해 줍니다.
 * 이렇게 하면 빌드된 HTML에도 expired signed URL이 포함되지 않습니다.
 */
function sanitizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  recordMap.signed_urls = recordMap.signed_urls || {};

  getPageImageUrls(recordMap, { mapImageUrl }).forEach(() => {
    Object.entries(recordMap.block).forEach(([blockId, { value: block }]) => {
      if (!block) return;

      // 이미지 블록: signed_urls + properties.source 치환
      if (block.type === 'image') {
        const signedUrl = recordMap.signed_urls?.[blockId];
        const src = block.properties?.source?.[0]?.[0];

        if (signedUrl) {
          recordMap.signed_urls[blockId] = mapImageUrl(signedUrl, block)!;
        } else if (src) {
          recordMap.signed_urls[blockId] = mapImageUrl(src, block)!;
        }

        if (src) {
          block.properties.source[0][0] = mapImageUrl(src, block)!;
        }
      }

      // 페이지 커버, 북마크 커버/아이콘 치환
      const format = (block.format as any) || {};
      if (format.page_cover) {
        format.page_cover = mapImageUrl(format.page_cover, block)!;
      }
      if (format.bookmark_cover) {
        format.bookmark_cover = mapImageUrl(format.bookmark_cover, block)!;
      }
      if (format.bookmark_icon) {
        format.bookmark_icon = mapImageUrl(format.bookmark_icon, block)!;
      }

      // 블록 아이콘 치환 (타입스크립트 우회)
      if ((block as any).icon && typeof (block as any).icon === 'string') {
        (block as any).icon = mapImageUrl((block as any).icon, block)!;
      }
    });
  });

  return recordMap;
}

export const getStaticProps: GetStaticProps<PageProps, Params> = async (
  context
) => {
  const rawPageId = context.params!.pageId as string;

  try {
    // 1) Notion 페이지 데이터 가져오기
    const notionProps = await resolveNotionPage(domain, rawPageId);

    // 2) recordMap 내 모든 이미지 URL을 안전하게 치환
    if ('recordMap' in notionProps) {
      notionProps.recordMap = sanitizeRecordMap(notionProps.recordMap);
    }

    // 3) 기존 notionProps에 pageId를 추가하여 새로운 props 객체를 생성합니다.
    const props: PageProps = { ...notionProps, pageId: rawPageId };

    return {
      props,
      revalidate: 5 // ISR 주기
    };
  } catch (err) {
    console.error('page error', domain, rawPageId, err);
    throw err;
  }
};

export async function getStaticPaths() {
  if (isDev) {
    return {
      paths: [],
      fallback: true
    };
  }

  const siteMap = await getSiteMap();

  return {
    paths: Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
      params: { pageId }
    })),
    fallback: true
  };
}

// 메타 정보 자동 생성 함수
function generateMeta(page: PageBlock | undefined, pageId: string) {
  // Notion 페이지의 속성에서 제목과 설명을 가져옵니다.
  const title = page?.properties?.title?.[0]?.[0] ?? '감정적인 건축가,아크(AaRC)';

  // 'site.config.ts'에서 설정한 설명(description) 속성 ID를 사용합니다.
  // 이렇게 하면 ID가 변경되어도 설정 파일만 수정하면 되므로 유지보수가 용이합니다.
  const descriptionPropId = notionPropIds?.description;
  const description =
    (descriptionPropId && page?.properties?.[descriptionPropId]?.[0]?.[0]) ?? siteDescription;

  // OG 이미지는 페이지 커버 > 기본 OG 이미지 순으로 사용합니다.
  const image =
    page?.format?.page_cover ?? 'https://aarc.kr/og-image.png';

  // Canonical URL(대표 URL)을 생성합니다.
  // 기본적으로 현재 페이지의 slug를 사용합니다. (예: https://aarc.kr/blog)
  let url = `https://aarc.kr/${pageId}`;

  // ### SEO 최적화 ###
  // 만약 현재 페이지가 블로그 목록 페이지('/blog')라면,
  // Canonical URL을 홈페이지('https://aarc.kr')로 지정합니다.
  // 이는 검색엔진에 "이 사이트의 대표 페이지는 홈페이지"라는 명확한 신호를 보내
  // 검색 순위 통합에 도움을 줍니다.
  const currentPageNotionId = page?.id?.replace(/-/g, '');

  // site.config.ts에 명시적으로 설정된 페이지의 경우, Canonical URL을 홈페이지로 지정합니다.
  // 이는 SEO 점수를 홈페이지로 통합하기 위한 전략입니다.
  if (pageUrlHomepageCanonical && currentPageNotionId === pageUrlHomepageCanonical) {
    url = 'https://aarc.kr';
  }

  return { title, description, image, url };
}

// Default export
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
