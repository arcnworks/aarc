module.exports = {
  siteUrl: 'https://aarc.vercel.app/', // 사이트의 기본 URL
  generateRobotsTxt: true, // robots.txt 파일 생성
  exclude: ['/server-sitemap.xml'], // 자동 생성 파일에서 제외
  robotsTxtOptions: {
    additionalSitemaps: [
      'https://aarc.vercel.app/report', // 추가할 동적 sitemap 경로
      'https://aarc.vercel.app/works', // 추가할 동적 sitemap 경로
      'https://aarc.vercel.app/blog', // 추가할 동적 sitemap 경로
    ],
  },
};
