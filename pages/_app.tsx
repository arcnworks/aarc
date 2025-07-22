import * as React from 'react';
import { useEffect } from 'react';

import type { AppProps } from 'next/app';
import { Noto_Sans_KR } from 'next/font/google'; // next/font에서 google과 local을 모두 import 합니다.
import localFont from 'next/font/local';
import { useRouter } from 'next/router';
import { GoogleAnalytics } from 'nextjs-google-analytics';

import axios from 'axios';
import { motion } from 'framer-motion';
import posthog from 'posthog-js';
import { RecoilRoot, useRecoilState } from 'recoil';
import { preferencesStore } from 'stores/settings';
import { SWRConfig, SWRConfiguration } from 'swr';

import PageLoading from '~/components/PageLoading';
import { bootstrap } from '~/lib/bootstrap-client';
import { posthogConfig, posthogId } from '~/lib/config';
import '~/styles/custom/index.scss';

import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react'; // 추가된 부분

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'], // 필요한 언어 서브셋을 지정합니다.
  weight: ['400', '700'], // 사용할 폰트 두께를 지정합니다.
  display: 'swap', // 폰트 로딩 전략을 설정합니다. (CLS 방지)
  variable: '--font-noto-sans-kr' // CSS 변수로 폰트를 사용합니다.
});

// 로컬 Pretendard 폰트를 설정합니다.
const pretendard = localFont({
  src: [
    {
      path: '../public/fonts/pretendard/Pretendard-Regular.woff2',
      weight: '400'
    },
    {
      path: '../public/fonts/pretendard/Pretendard-Bold.woff2',
      weight: '700'
    }
  ],
  variable: '--font-pretendard', // CSS 변수로 폰트를 사용합니다.
  display: 'swap' // font-display: swap을 자동으로 적용하여 FOIT를 방지합니다.
});

const Bootstrap = () => {
  const [preferences, setPreferences] = useRecoilState(preferencesStore);
  const router = useRouter();

  // posthog
  useEffect(() => {
    function onRouteChangeComplete() {
      if (posthogId) {
        posthog.capture('$pageview');
      }
    }

    // PostHog 초기화
    if (posthogId) {
      posthog.init(posthogId, posthogConfig);
    }

    // 라우터 이벤트 리스너 등록
    router.events.on('routeChangeComplete', onRouteChangeComplete);

    // is-root-page 클래스 관리
    if (router.pathname === '/') {
      document.body.classList.add('is-root-page');
    } else {
      document.body.classList.remove('is-root-page');
    }

    return () => {
      router.events.off('routeChangeComplete', onRouteChangeComplete);
    };
  }, [router.events, router.pathname]);

  useEffect(() => {
    if (preferences.isDarkMode) {
      if (!document.body.classList.contains('dark-mode')) {
        document.body.classList.add('dark-mode');
      }
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [preferences.isDarkMode]);

  useEffect(() => {
    // 클라이언트 측 초기 설정 실행
    bootstrap();

    // 마우스 오른쪽 클릭 방지 이벤트 리스너
    const handleContextmenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextmenu);

    // OS 다크모드 변경 감지 리스너
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setPreferences({ ...preferences, isDarkMode: event.matches });
    };
    mediaQuery.addEventListener('change', handleChange);

    // 접근성 개선: react-notion-x의 검색 버튼에 aria-label 추가
    // Lighthouse "button, link, and menuitem elements do not have an accessible name" 문제 해결
    const searchButton = document.querySelector('.notion-search-button');
    if (searchButton && !searchButton.getAttribute('aria-label')) {
      searchButton.setAttribute('aria-label', '검색');
    }

    return () => {
      document.removeEventListener('contextmenu', handleContextmenu);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [preferences, setPreferences]); // setPreferences와 preferences를 의존성 배열에 추가

  return null;
};

const swrConfig: SWRConfiguration = {
  errorRetryCount: 3,
  errorRetryInterval: 500,
  revalidateOnFocus: false,
  revalidateIfStale: false,
  fetcher: (url: string) => axios.get(url).then(res => res.data),
};

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <RecoilRoot>
      {/* Pretendard와 Noto_Sans_KR 폰트의 CSS 변수를 모두 main 태그에 적용합니다. */}
      <main className={`${pretendard.variable} ${notoSansKr.variable}`}>
        <SWRConfig value={swrConfig}>
          <Bootstrap />
          <GoogleAnalytics trackPageViews />
          <PageLoading />

          <motion.div
            key={router.pathname + router.query?.pageId || ''}
            initial={{ x: 10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Component {...pageProps} />
            <SpeedInsights />
            <Analytics /> {/* ← Vercel Web Analytics 삽입 위치 */}
          </motion.div>
        </SWRConfig>
      </main>
    </RecoilRoot>
  );
}
