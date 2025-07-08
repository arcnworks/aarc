import * as React from 'react';
import { useEffect } from 'react';

import type { AppProps } from 'next/app';
import { Noto_Sans_KR } from 'next/font/google';
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

const Bootstrap = () => {
  const [preferences, setPreferences] = useRecoilState(preferencesStore);
  const router = useRouter();

  useEffect(() => {
    // 루트 경로('/')일 때 body에 is-root-page 클래스를 추가합니다.
    if (router.pathname === '/') {
      document.body.classList.add('is-root-page');
    } else {
      document.body.classList.remove('is-root-page');
    }
  }, [router.pathname]);

  // posthog
  useEffect(() => {
    function onRouteChangeComplete() {
      if (posthogId) {
        posthog.capture('$pageview');
      }
    }

    if (posthogId) {
      posthog.init(posthogId, posthogConfig);
    }

    router.events.on('routeChangeComplete', onRouteChangeComplete);

    return () => {
      router.events.off('routeChangeComplete', onRouteChangeComplete);
    };
  }, [router.events]);

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
    bootstrap();

    // 기기의 다크모드 연동
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      setPreferences({ ...preferences, isDarkMode: event.matches });
    });
  }, []);

  // 마우스 오른쪽 클릭 방지
  useEffect(() => {
    const handleContextmenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextmenu);

    // 컴포넌트가 언마운트될 때 이벤트 리스너를 제거합니다.
    return () => {
      document.removeEventListener('contextmenu', handleContextmenu);
    };
  }, []);

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
      <main className={notoSansKr.variable}>
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
