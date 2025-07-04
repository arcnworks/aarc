/** @type {import('next-sitemap').IConfig} */
module.exports = {
  // 사이트의 기본 URL
  siteUrl: 'https://aarc.kr',

  // sitemap.xml 파일 생성
  generateSitemap: true,

  // robots.txt 파일 생성
  generateRobotsTxt: true,

  // 사이트맵에서 제외할 페이지 경로
  exclude: [
    '/draftview', // 임시/미리보기 페이지
    '/server-sitemap.xml', // sitemap index 파일에서 제외
    '/404', // 404 에러 페이지
    '/500', // 500 에러 페이지
  ],

  // robots.txt 파일에 적용할 규칙
  robotsTxtOptions: {
    // 모든 검색 엔진에 적용될 정책
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: '*',
        // /qna/ 경로 및 그 하위 모든 경로 크롤링 금지
        disallow: ['/qna/'],
      },
    ],
    // sitemap.xml 경로를 자동으로 추가해 주므로 additionalSitemaps는 필요 없습니다.
  },
};
