import * as React from 'react';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import localFont from 'next/font/local';
import { useRouter } from 'next/router';
import Head from 'next/head'; 
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

const pretendard = localFont({
  src: [
    { path: '../public/fonts/pretendard/Pretendard-Regular.subset.woff2', weight: '400' },
    { path: '../public/fonts/pretendard/Pretendard-Bold.subset.woff2', weight: '700' }
  ],
  variable: '--font-pretendard',
  display: 'swap'
});

const Bootstrap = () => {
  const [preferences] = useRecoilState(preferencesStore);
  const router = useRouter();
  const scrollCache = React.useRef<Record<string, number>>({});

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';

    const handleRouteChangeStart = () => { scrollCache.current[router.asPath] = window.scrollY; };
    const handleRouteChangeComplete = (url: string) => {
      if (posthogId) posthog.capture('$pageview');
      const savedPosition = scrollCache.current[url];
      if (savedPosition !== undefined) setTimeout(() => { window.scrollTo({ top: savedPosition, behavior: 'instant' }); }, 150); 
      else window.scrollTo(0, 0);
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

  useEffect(() => {
    if (preferences.isDarkMode) { if (!document.body.classList.contains('dark-mode')) document.body.classList.add('dark-mode'); } 
    else { document.body.classList.remove('dark-mode'); }
  }, [preferences.isDarkMode]);

  useEffect(() => {
    bootstrap();
    const style = document.createElement('style');
    style.innerHTML = `html { scrollbar-gutter: stable; overflow-y: scroll; }`;
    document.head.appendChild(style);
    return () => { if (document.head.contains(style)) document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => { e.preventDefault(); };
    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

  return null;
};

const swrConfig: SWRConfiguration = { fetcher: (url: string) => axios.get(url).then(res => res.data) };

export default function App({ Component, pageProps, router }: AppProps) {
  
  // ✅ [AaRC 엔진 모니터링 및 주입] 
  useEffect(() => {
    console.log("🟦 [STEP 1] _app.tsx 마운트 완료. 구글 번역 엔진 세팅 시작.");

    // 1. 번역 엔진 초기화 함수
    (window as any).googleTranslateElementInit = () => {
      console.log("🟩 [STEP 3] 구글 엔진 스크립트 응답 완료! (googleTranslateElementInit 실행)");
      try {
        if ((window as any).google?.translate?.TranslateElement) {
          new (window as any).google.translate.TranslateElement({
            pageLanguage: 'ko',
            includedLanguages: 'en,ja,ru,es,zh-CN',
            autoDisplay: false
          }, 'google_translate_element');
          console.log("🟩 [STEP 4] 구글 번역기 객체 시공 완료! (div#google_translate_element에 삽입됨)");
        } else {
          console.error("🟥 [STEP 4 에러] google.translate.TranslateElement 함수를 찾을 수 없습니다.");
        }
      } catch(err) {
        console.error("🟥 [STEP 4 에러] 번역기 생성 중 치명적 오류 발생:", err);
      }
    };

    // 2. 엔진 스크립트 강제 삽입
    const scriptId = 'google-translate-script';
    if (!document.getElementById(scriptId)) {
      console.log("🟦 [STEP 2] 스크립트 다운로드 요청 (element.js)");
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.onload = () => console.log("🟩 [STEP 2-1] 스크립트 파일 다운로드 성공!");
      script.onerror = () => console.error("🟥 [STEP 2-2 에러] 스크립트 다운로드 실패! (광고차단기, VPN, 네트워크 상태를 확인하세요)");
      document.body.appendChild(script);
    } else {
      console.log("🟨 [STEP 2 건너뜀] 스크립트가 이미 존재합니다.");
    }
  }, []);

  return (
    <RecoilRoot>
      <main className={pretendard.variable}>
        <SWRConfig value={swrConfig}>
          <Bootstrap />

          <Head>
            <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4024008858265935" crossOrigin="anonymous" />
          </Head>

          <GoogleAnalytics trackPageViews />
          <Loading />

          {/* 🚨 엔진이 자리 잡을 절대 파괴되지 않는 공간 */}
          <div id="google_translate_element" style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden', zIndex: -100, opacity: 0 }}></div>

          <motion.div key={router.asPath} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ width: '100%' }}>
            <Component {...pageProps} />
            <SpeedInsights />
            <Analytics />
          </motion.div>
        </SWRConfig>
      </main>
    </RecoilRoot>
  );
}