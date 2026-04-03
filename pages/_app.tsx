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

// [핵심] 1단계에서 삭제한 PageLoading 대신, Loading.tsx를 전역에서 정확하게 불러옵니다.
import { Loading } from '~/components/Loading'; 

import { bootstrap } from '~/lib/bootstrap-client';
import { posthogConfig, posthogId } from '~/lib/config';

import 'react-notion-x/src/styles.css'; 
import 'rc-dropdown/assets/index.css';

import '~/styles/custom/index.scss';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-noto-sans-kr'
});

const pretendard = localFont({
  src: [
    { path: '../public/fonts/pretendard/Pretendard-Regular.subset.woff2', weight: '400' },
    { path: '../public/fonts/pretendard/Pretendard-Bold.subset.woff2', weight: '700' }
  ],
  variable: '--font-pretendard',
  display: 'swap'
});

const Bootstrap = () => {
  const [preferences, setPreferences] = useRecoilState(preferencesStore);
  const router = useRouter();

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

  useEffect(() => {
    if (preferences.isDarkMode) {
      if (!document.body.classList.contains('dark-mode')) document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [preferences.isDarkMode]);

  useEffect(() => {
    bootstrap();
    const style = document.createElement('style');
    style.innerHTML = `html { scrollbar-gutter: stable; overflow-y: scroll; }`;
    document.head.appendChild(style);
    return () => { if (document.head.contains(style)) document.head.removeChild(style); };
  }, []);

  return null;
};

const swrConfig: SWRConfiguration = {
  fetcher: (url: string) => axios.get(url).then(res => res.data),
};

export default function App({ Component, pageProps, router }: AppProps) {
  return (
    <RecoilRoot>
      <main className={`${pretendard.variable} ${notoSansKr.variable}`}>
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