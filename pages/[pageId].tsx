import * as React from 'react';
import { GetStaticProps } from 'next';
import { isDev, domain } from 'lib/config';
import { getSiteMap } from 'lib/get-site-map';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import { PageProps, Params } from 'lib/types';
import { NotionPage } from 'components';
import Meta from '../components/Meta';

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params.pageId as string;

  try {
    const props = await resolveNotionPage(domain, rawPageId);
    return { props, revalidate: 5 };
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

// ✅ 메타 정보 자동 생성 함수
function generateMeta(page) {
  const title =
    page?.properties?.title?.[0]?.[0] || 'AaRC | 느낌과 공간을 연결하는 건축 스튜디오';

  const description =
    page?.properties?.['ZbRi']?.[0]?.[0] ||
    'AaRC(아크)는 과학적 통찰과 인문적 감수성으로 느낌의 경험을 담는 특별한 공간을 디자인합니다.';

  const image =
    page?.cover?.external?.url ||
    page?.cover?.file?.url ||
    'https://aarc.kr/og-image.jpg';

  const url = `https://aarc.kr/${page?.id?.replace(/-/g, '')}`;

  return { title, description, image, url };
}

export default function NotionDomainDynamicPage(props) {
  const { page } = props;
  const meta = generateMeta(page);

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
