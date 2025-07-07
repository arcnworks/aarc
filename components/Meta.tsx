import * as React from 'react';
import Head from 'next/head';
import { name, description as siteDescription, host } from 'lib/config';

export interface MetaProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  keywords?: string;
}

const Meta = ({
  title = name,
  description = siteDescription,
  image = `${host}/og-image.png`,
  url = host,
  keywords = '감정적인 건축가, 감정적인건축가, 감정의 건축, 감정의건축, 느낌의 공간, 느낌의공간, 느낌의 건축, 느낌의건축, 감정적인 건축가 아크, 감정적인건축가아크, 아크, 아쿠, 아아크, AaRC, aarc',
}: MetaProps) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={url} />

      <meta property="og:site_name" content={name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Head>
  );
};

export default Meta;
