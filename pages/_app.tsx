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

  // _app.tsx 파일의 Bootstrap 컴포넌트 내부에 추가
const Bootstrap = () => {
  const [preferences] = useRecoilState(preferencesStore);
  const router = useRouter();
  const scrollCache = React.useRef<Record<string, number>>({});

  // ... 기존의 대포적인 useEffect들 (scrollRestoration, handleGlobalClick 등) 유지 ...

  // 🚨 [AaRC 최종 병기] 토글 버튼 및 인페이지 블록 클릭 시 404 라우팅 원천 차단 가드
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      try {
        const pathname = url.split(/[?#]/)[0];
        const cleanId = pathname.replace(/^\//, '').toLowerCase();

        // 1. 이동하려는 Next.js 라우터 경로가 순수 32자리 노션 블록 ID 포맷인지 검사
        if (/^[a-f0-9]{32}$/i.test(cleanId)) {
          
          // 2. 🎯 [핵심] 현재 화면(DOM) 상에 해당 클래스나 ID를 가진 블록이 실재하는지 체크합니다.
          // 현재 페이지 내에 존재하는 토글/헤더 블록이라면 새 페이지로 이동할 필요가 없는 인페이지 요소입니다.
          const isElementInDOM = 
            document.querySelector(`.notion-block-${cleanId}`) || 
            document.getElementById(cleanId);

          if (isElementInDOM) {
            // 3. 외부 404 페이지로 튕기려는 Next.js 라우터 엔진 트랜지션을 강제로 취소시킵니다.
            router.events.emit('routeChangeError');
            
            // 4. 주소창의 해시값만 부드럽게 변경하여 브라우저가 자체 토글/앵커 스크롤을 하도록 유도합니다.
            window.location.hash = cleanId;
            
            // 5. Next.js 백그라운드 데이터(.json) 네트워크 호출을 즉시 중단(Abort)하는 시그널을 던집니다.
            throw 'routeChangeAborted';
          }
        }
      } catch (err) {
        // Next.js 라우터 중단 에러는 정상적인 취소 흐름이므로 시스템 에러로 빠지지 않게 격리합니다.
        if (err === 'routeChangeAborted') throw err;
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [router]);

  return null;
};

  // _app.tsx 내부의 useEffect 처리 파트
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a'); 
      if (anchor && anchor.href && anchor.target !== '_blank' && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        try {
          const url = new URL(anchor.href, window.location.origin);
          
          // 🎯 [수정] 과도하게 정상 라우팅을 막던 isPureBlockId 방어벽을 제거합니다.
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

    // 1. 번역 엔진 초기화 함수
    (window as any).googleTranslateElementInit = () => {
      try {
        if ((window as any).google?.translate?.TranslateElement) {
          new (window as any).google.translate.TranslateElement({
            pageLanguage: 'ko',
            includedLanguages: 'en,ja,ru,es,zh-CN',
            autoDisplay: false
          }, 'google_translate_element');
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
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.onerror = () => console.error("🟥 [STEP 2-2 에러] 스크립트 다운로드 실패! (광고차단기, VPN, 네트워크 상태를 확인하세요)");
      document.body.appendChild(script);
    } else {
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

          {/* ✅ [수정] key={router.asPath} 제거: 페이지 이동 시 트리 언마운트 방지 (토글 상태 보존) */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} style={{ width: '100%' }}>
            <Component {...pageProps} />
            <SpeedInsights />
            <Analytics />
          </motion.div>
        </SWRConfig>
      </main>
    </RecoilRoot>
  );
}