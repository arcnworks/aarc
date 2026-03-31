import * as React from 'react'
import { GetStaticProps } from 'next'
import Head from 'next/head'

import { domain, isDev } from 'lib/config'
import { getSiteMap } from 'lib/get-site-map'
import { resolveNotionPage } from 'lib/resolve-notion-page'
import { NotionPage } from 'components'
import { PageProps, Params } from 'lib/types'

export const getStaticProps: GetStaticProps<PageProps, Params> = async (context) => {
  const rawPageId = context.params!.pageId as string

  try {
    const props = await resolveNotionPage(domain, rawPageId)

    return {
      props,
      revalidate: 10
    }
  } catch (err) {
    console.error('page load error', rawPageId, err)

    // 에러 발생 시 404 페이지를 반환합니다.
    return {
      notFound: true,
      revalidate: 10
    }
  }
}

export async function getStaticPaths() {
  if (isDev) {
    return {
      paths: [],
      fallback: true
    }
  }

  const siteMap = await getSiteMap()

  const paths = Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
    params: {
      pageId
    }
  }))

  return {
    paths,
    fallback: true
  }
}

export default function NotionDomainDynamicPage(props: PageProps) {
  return (
    <>
      <Head>
        <meta property='og:site_name' content='AaRC' />
        <meta property='og:type' content='article' />
        <meta name='twitter:card' content='summary_large_image' />
      </Head>

      <NotionPage {...props} />
    </>
  )
}