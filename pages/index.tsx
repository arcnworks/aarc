import * as React from 'react';
import Head from 'next/head';

import { NotionPage } from 'components';
import { domain, host } from 'lib/config';
import { resolveNotionPage } from 'lib/resolve-notion-page';
import Meta from '../components/Meta';

export const getStaticProps = async a => {
  try {
    const props = await resolveNotionPage(domain);

    return { props, revalidate: 5 };
  } catch (err) {
    console.error('page error', domain, err);

    // we don't want to publish the error version of this page, so
    // let next.js know explicitly that incremental SSG failed
    throw err;
  }
};

export default function NotionDomainPage(props) {
  // console.log(props);
  const title = `감정적인 건축가, 아크(AaRC) | 과학과 감성으로 공간을 디자인합니다`;
  const description =
    'AaRC(아크)는 과학적 통찰과 인문적 감수성으로 느낌의 경험을 담는 특별한 공간을 디자인하는 감정적인 건축가 그룹입니다.';

  return (
    <>
      <Meta
        title={title}
        description={description}
        url={host} // 홈페이지의 대표 URL을 명시적으로 전달합니다.
      />
      <NotionPage {...props} />
    </>
  );
}