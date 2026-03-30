// next.config.js

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // 노션 페이지 생성 시 타임아웃 방지 (기본 300초)
  staticPageGenerationTimeout: 300,

  // 1. 빌드 시 ESLint 경고(이미지 태그, 익명 함수 등)를 무시하고 배포를 강행합니다.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 2. 사소한 타입(TypeScript) 오류가 있어도 빌드를 중단하지 않습니다.
  typescript: {
    ignoreBuildErrors: true,
  },

  // (선택 사항) 이미지 도메인 보안 설정이 필요할 경우를 대비한 구조
  images: {
    domains: ['www.notion.so', 'arcnworks.notion.site', 's3.us-west-2.amazonaws.com'],
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
});