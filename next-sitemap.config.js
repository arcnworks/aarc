/** @type {import('next-sitemap').IConfig} */

module.exports = {
  // 1. 사이트 기본 정보 (메인 도메인)
  siteUrl: process.env.SITE_URL || 'https://aarc.kr',
  generateRobotsTxt: true,
  sitemapSize: 7000,

  // 2. 검색 엔진에서 제외할 경로 (청소 및 정리)
  exclude: [
    '/home',      // '/'와 중복되므로 제외
    '/feed',      // 사용하지 않는 메뉴 제외
    '/draftview', // 임시 페이지 제외
    '/404', 
    '/500',
    '/qna*',      // 서비스 페이지 위계 정리
    '/category*',
    '/api/*',
  ],

  // 3. ✅ 핵심: 실제 포스트 슬러그(34개) 직접 주입
  // 구글 로봇에게 실제 글 주소를 하나하나 정확히 알려줍니다.
  additionalPaths: async (config) => {
    const slugs = [
      '342693fb941780dba27af82174a21e0e',
      '1e7693fb94178078bfe8f80714004dbc',
      '1b9693fb941780e798e1ce579d764691',
      '1b5693fb941780398e58c14b5aef3ca0',
      '193693fb9417804f85ffefa473d8cb6b',
      '188693fb941780fbaee0fc7f2d27dbb8',
      '17e693fb9417802ab98cfc998f7cf487',
      '176693fb9417809a83a6cf0ae6cea07e',
      '175693fb9417801e9cfbc175ad37349b',
      '173693fb9417808bb286d78999027c4c',
      '170693fb941780019039dbd1cb92af45',
      '16f693fb941780cf96f4d4da72e4ba40',
      '169693fb9417804c9b61da8e9488e3c6',
      '169693fb941780b1ac98cc60f8184ae0',
      '166693fb941780cca2ecc40c34bdcd7b',
      '335693fb941780e19d5be0812c1ed82e',
      '335693fb94178082b5d5c1e952c902d9',
      '339693fb941780b18036e8944800b9c8',
      '339693fb941780889040d344551784ee',
      '334693fb941780208f25ea60ccfb0a93',
      '335693fb94178016bcecde37fb5d8861',
      '335693fb94178043bc87d9e98451a46b',
      '335693fb941780f082ead72422ffbe39',
      '335693fb94178040ae58fe9da58ca4e2',
      '335693fb941780329824f770664ad52f',
      '335693fb94178097a852c8cf26a0be61',
      '335693fb941780b19a6cf16b3849a905',
      '335693fb94178086a02fd76cfd4ab483',
      '334693fb941780008483c788e17f3faa',
      '334693fb9417804fb379c03175d8be9a',
      '334693fb9417806f87c0e425566cebe8',
      '334693fb94178024afecc00b78591ba4',
      '335693fb941780bd8ae3ee01e0a7f7de',
      '334693fb94178001a01ec8769fc6615b'
    ];

    return slugs.map((slug) => ({
      loc: `/${slug}`,
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    }));
  },

  // 4. 페이지 위계별 가중치(Priority) 최적화
  transform: async (config, path) => {
    let priority = 0.7;
    let changefreq = 'weekly';

    if (path === '/') {
      priority = 1.0;
      changefreq = 'daily';
    } else if (['/work', '/blog'].includes(path)) {
      priority = 0.9;
      changefreq = 'daily';
    } else if (path === '/contact') {
      priority = 0.8;
      changefreq = 'monthly';
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    };
  },

  // 5. 구글 애드센스 및 크롤러 지침 (robots.txt)
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/get-tweet-ast/*',
          '/api/search-notion',
          '/draftview',
          '/qna/',
          '/category/',
          '/contact/',
          '/*?*', // 중복 색인 방지
        ],
      },
      {
        // 애드센스 광고를 위한 MediaPartners 허용
        userAgent: 'MediaPartners-Google',
        allow: '/',
      }
    ],
    additionalSitemaps: [
      'https://aarc.kr/sitemap.xml',
    ],
  },
};