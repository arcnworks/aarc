import * as React from 'react';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import localFont from 'next/font/local'; // ✅ Noto_Sans_KR 삭제 (경량화)
import { useRouter } from 'next/router';
import Script from 'next/script'; // ✅ 누락된 Script 임포트 추가
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

  // [공정 1] 스크롤 복원 및 페이지 뷰 트래킹 (AaRC 고도화 스크롤 엔진)
  const scrollCache = React.useRef<Record<string, number>>({});

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const handleRouteChangeStart = () => {
      scrollCache.current[router.asPath] = window.scrollY;
    };

    const handleRouteChangeComplete = (url: string) => {
      if (posthogId) posthog.capture('$pageview');
      const savedPosition = scrollCache.current[url];
      
      if (savedPosition !== undefined) {
        setTimeout(() => {
          window.scrollTo({ top: savedPosition, behavior: 'instant' });
        }, 150); 
      } else {
        window.scrollTo(0, 0);
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    if (router.pathname === '/') document.body.classList.add('is-root-page');
    else document.body.classList.remove('is-root-page');

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events, router.pathname, router.asPath]);

  // [공정 2] 글로벌 하이퍼링크 인터셉터
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a'); 
      if (anchor && anchor.href && anchor.target !== '_blank' && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        try {
          const url = new URL(anchor.href, window.location.origin);
          if (url.origin === window.location.origin && url.pathname !== router.asPath) {
            e.preventDefault();
            window.dispatchEvent(new Event('trigger-arc-loading'));
            router.push(url.pathname + url.search + url.hash);
          }
        } catch (err) {}
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

  // [공정 5] 🚨 사이트 전체 우클릭 방지 (AaRC 보안 엔진)
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
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
      <main className={pretendard.variable}>
        <SWRConfig value={swrConfig}>
          <Bootstrap />

          {/* 🚨 구글 애드센스 코드 스니펫 주입 (ca-pub-4024008858265935) */}
          <Script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4024008858265935"
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />

          <GoogleAnalytics trackPageViews />
          <Loading />

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