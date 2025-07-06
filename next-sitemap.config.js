/** @type {import('next-sitemap').IConfig} */
module.exports = {
  // 사이트의 기본 URL. 환경 변수(process.env.SITE_URL)가 있으면 그 값을 사용하고,
  // 없으면 'https://aarc.kr'를 기본값으로 사용합니다.
  siteUrl: process.env.SITE_URL || 'https://aarc.kr',

  // robots.txt 파일 생성
  generateRobotsTxt: true,

  // 사이트맵에서 제외할 페이지 경로
  exclude: [
    '/home', // 홈페이지는 '/'가 대표 URL이므로 중복되는 '/home'을 제외합니다.
    '/draftview', // 임시/미리보기 페이지 (기존)
    '/404', // 404 에러 페이지
    '/500', // 500 에러 페이지
  ],

  // 페이지별 우선순위(priority)를 동적으로 설정합니다.
  // priority는 0.0에서 1.0 사이의 값이며, 검색 엔진에 페이지의 상대적 중요도를 알려줍니다.
  // 기본값은 0.7입니다.
  transform: async (config, path) => {
    let priority = config.priority; // 기본 우선순위 (0.7)

    // 홈페이지('/')의 우선순위를 1.0으로 가장 높게 설정합니다.
    if (path === '/') {
      priority = 1.0;
    }
    // 주요 페이지(blog, about 등)의 우선순위를 약간 높게 설정할 수 있습니다.
    else if (path === '/blog' || path === '/report') {
      priority = 0.9;
    }

    return {
      loc: path, // 페이지 경로
      changefreq: config.changefreq, // 변경 빈도
      priority: priority, // 설정된 우선순위
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined, // 마지막 수정일
    };
  },

  // robots.txt 파일에 적용할 규칙
  robotsTxtOptions: {
    // 모든 검색 엔진에 적용될 정책
    // 동일한 userAgent에 대한 규칙은 하나로 묶는 것이 좋습니다.
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/get-tweet-ast/*',
          '/api/search-notion',
          '/draftview',
          '/qna/', // /qna/ 경로 및 그 하위 모든 경로 크롤링 금지
          '/category/', // /카테고리/ 경로 및 그 하위 모든 경로 크롤링 금지
        ],
      },
    ],
  },
};
