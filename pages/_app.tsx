import * as React from 'react';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Noto_Sans_KR } from 'next/font/google';
import localFont from 'next/font/local';
import { useRouter } from 'next/router';
import { GoogleAnalytics } from 'nextjs-google-analytics';
import axios from 'axios';
import { motion } from 'framer-motion'; 
import posthog from 'posthog-js';
import { RecoilRoot, useRecoilState } from 'recoil';
import { preferencesStore } from 'stores/settings';
import { SWRConfig, SWRConfiguration } from 'swr';

// [컴포넌트] 로딩 커튼 및 부트스트랩 로직
import { Loading } from '~/components/Loading'; 
import { bootstrap } from '~/lib/bootstrap-client';
import { posthogConfig, posthogId } from '~/lib/config';

// [스타일] 외부 라이브러리 및 커스텀 SCSS
import '../packages/react-notion-x/styles.css';
import 'rc-dropdown/assets/index.css';
import '~/styles/custom/index.scss';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

/* ---------------------------------------------------------
   1. 폰트 및 글로벌 규격 설정
   --------------------------------------------------------- */


const pretendard = localFont({
  src: [
    { path: '../public/fonts/pretendard/Pretendard-Regular.subset.woff2', weight: '400' },
    { path: '../public/fonts/pretendard/Pretendard-Bold.subset.woff2', weight: '700' }
  ],
  variable: '--font-pretendard',
  display: 'swap'
});

/* ---------------------------------------------------------
   2. Bootstrap: 시스템 설정 및 글로벌 클릭 인터셉터
   --------------------------------------------------------- */
const Bootstrap = () => {
  const [preferences] = useRecoilState(preferencesStore);
  const router = useRouter();

  // [공정 1] 스크롤 복원 및 페이지 뷰 트래킹
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    function onRouteChangeComplete() {
      if (posthogId) posthog.capture('$pageview');
      window.scrollTo(0, 0); 
    }

    if (posthogId) posthog.init(posthogId, posthogConfig);
    router.events.on('routeChangeComplete', onRouteChangeComplete);

    if (router.pathname === '/') document.body.classList.add('is-root-page');
    else document.body.classList.remove('is-root-page');

    return () => {
      router.events.off('routeChangeComplete', onRouteChangeComplete);
    };
  }, [router.events, router.pathname]);

  // [공정 2] 🚨 글로벌 하이퍼링크 인터셉터 (Loading.tsx 트리거용)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a'); // 클릭된 요소 주변의 <a> 태그를 찾습니다.

      if (
        anchor && 
        anchor.href && 
        anchor.target !== '_blank' && 
        !e.defaultPrevented && 
        !e.metaKey && !e.ctrlKey && !e.shiftKey
      ) {
        try {
          const url = new URL(anchor.href, window.location.origin);
          // 내부 링크 이동일 때만 작동
          if (url.origin === window.location.origin && url.pathname !== router.asPath) {
            e.preventDefault();
            
            // 1. 일반 링크를 누를 때도 무적 로딩 신호를 발사합니다.
            window.dispatchEvent(new Event('trigger-arc-loading'));
            
            // 2. 전체 주소(http://...)가 아닌 상대 경로(/blog 등)로 안전하게 이동
            router.push(url.pathname + url.search + url.hash);
          }
        } catch (err) {
          // URL 파싱 에러 무시
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [router]);

  // [공정 3] 다크모드 무결성 유지
  useEffect(() => {
    if (preferences.isDarkMode) {
      if (!document.body.classList.contains('dark-mode')) document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [preferences.isDarkMode]);

  // [공정 4] 초기 부트스트랩 및 스크롤바 제어
  useEffect(() => {
    bootstrap();
    const style = document.createElement('style');
    style.innerHTML = `html { scrollbar-gutter: stable; overflow-y: scroll; }`;
    document.head.appendChild(style);
    return () => { if (document.head.contains(style)) document.head.removeChild(style); };
  }, []);

  return null;
};

/* ---------------------------------------------------------
   3. 메인 App 컴포넌트
   --------------------------------------------------------- */
const swrConfig: SWRConfiguration = {
  fetcher: (url: string) => axios.get(url).then(res => res.data),
};

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <RecoilRoot>
      {/* ✅ 노토산스 변수를 삭제하고 프리텐다드만 남겼습니다. */}
      <main className={pretendard.variable}>
        <SWRConfig value={swrConfig}>
          <Bootstrap />
          <GoogleAnalytics trackPageViews />
          
          {/* 전역 로딩 커튼 배치 */}
          <Loading />

          {/* 대기 모드 없이 즉각적인 뒷단 빌드 허용 */}
          <motion.div
            key={router.asPath}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }} 
            style={{ width: '100%' }}
          >
            <Component {...pageProps} />
            <SpeedInsights />
            <Analytics />
          </motion.div>
        </SWRConfig>
      </main>
    </RecoilRoot>
  );
}