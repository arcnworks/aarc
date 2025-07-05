import * as React from 'react';
import Head from 'next/head';
import { name, description as siteDescription, host } from 'lib/config';

export interface MetaProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const Meta = ({
  title = name,
  description = siteDescription,
  image = `${host}/og-image.png`,
  url = host,
}: MetaProps) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
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
