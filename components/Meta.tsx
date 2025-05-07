import React from 'react';
import Head from 'next/head';

interface MetaProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export const Meta = ({
  title,
  description,
  image = 'https://aarc.kr/og-image.jpg',
  url = 'https://aarc.kr'
}: MetaProps) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content="AaRC, aarc, 감정적인 건축가, 공간디자인, 신경건축학, 감성디자인, neuroarchitecture, 건축브랜딩, 공간브랜딩, 인간 중심 설계" />
      <meta name="author" content="이원호" />
      <link rel="canonical" href={url} />

      {/* Open Graph (Facebook, Kakao 등) */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="AaRC" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Head>
  );
};

export default Meta;
