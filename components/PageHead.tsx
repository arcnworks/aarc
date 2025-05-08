import Head from 'next/head';
import * as React from 'react';
import { useRouter } from 'next/router';

import * as types from 'lib/types';
import * as config from 'lib/config';
import { getSocialImageUrl } from 'lib/get-social-image-url';

export const PageHead: React.FC<
  types.PageProps & {
    title?: string;
    description?: string;
    image?: string;
  }
> = ({ site, title, description, pageId, image }) => {
  const router = useRouter();
  const canonicalUrl = `${config.host}${router.asPath.split('?')[0]}`;

  const pageTitle = title ?? site?.name ?? config.name;
  const pageDescription = description ?? site?.description ?? config.description;
  const socialImageUrl = getSocialImageUrl(pageId) || image || `${config.host}/og-image.jpg`;

  const rssFeedUrl = `${config.host}/feed`;

  return (
    <Head>
      {/* 기본 메타 */}
      <meta charSet="utf-8" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      <meta name="robots" content="index,follow" />

      {/* 제목 및 설명 */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />

      {/* URL 관련 메타 */}
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="twitter:url" content={canonicalUrl} />

      {/* OG 이미지 */}
      <meta property="og:image" content={socialImageUrl} />
      <meta name="twitter:image" content={socialImageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta property="og:type" content="website" />

      {/* 사이트 정보 */}
      <meta property="og:site_name" content={site?.name ?? config.name} />
      <meta property="twitter:domain" content={site?.domain ?? config.domain} />
      {config.twitter && <meta name="twitter:creator" content={`@${config.twitter}`} />}

      {/* RSS */}
      <link rel="alternate" type="application/rss+xml" href={rssFeedUrl} title={pageTitle} />

      {/* 구조화 데이터 (Schema.org JSON-LD) */}
      <script type="application/ld+json">
        {`
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "AaRC",
          "alternateName": "Architecture and Research in Culture",
          "url": "https://aarc.kr",
          "logo": "https://aarc.kr/og-image.jpg",
          "description": "과학적 통찰과 인문적 감수성으로 느낌의 경험을 설계하는 공간 디자인 스튜디오 AaRC의 공식 블로그 입니다.",
          "sameAs": [
            "https://www.instagram.com/arcnworks",
            "https://www.youtube.com/@arcnworks",
            "mailto:a@aarc.kr"
          ],
          "founder": {
            "@type": "Person",
            "name": "이원호"
          },
          "foundingDate": "2022",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "KR"
          }
        }
        `}
      </script>
    </Head>
  );
};
