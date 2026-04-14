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
  
    // [공정 1] 스크롤 복원 및 페이지 뷰 트래킹 (AaRC 고도화 스크롤 엔진)
  // 💡 URL별 스크롤 위치를 기억할 전역 캐시 (컴포넌트 외부에 선언하거나 useRef 사용 권장)
  const scrollCache = React.useRef<Record<string, number>>({});

  useEffect(() => {
    // 1. 브라우저의 자동 복원 기능을 수동(manual)으로 설정하여 우리가 직접 통제합니다.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // 2. 페이지를 떠나기 직전의 스크롤 위치를 기록합니다.
    const handleRouteChangeStart = () => {
      scrollCache.current[router.asPath] = window.scrollY;
    };

    // 3. 페이지 로드가 완료되었을 때 복원 처리를 수행합니다.
    const handleRouteChangeComplete = (url: string) => {
      if (posthogId) posthog.capture('$pageview');

      const savedPosition = scrollCache.current[url];
      
      if (savedPosition !== undefined) {
        // [뒤로가기 상황] 
        // 노션 콘텐츠가 렌더링되고 motion.div 애니메이션이 진행되는 시간을 고려하여 
        // 150ms 정도의 지연 후 저장된 위치로 스크롤을 복원합니다.
        setTimeout(() => {
          window.scrollTo({ top: savedPosition, behavior: 'instant' });
        }, 150); 
      } else {
        // [새 페이지 이동 상황] 최상단으로 이동
        window.scrollTo(0, 0);
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    // 루트 페이지 전용 클래스 관리
    if (router.pathname === '/') document.body.classList.add('is-root-page');
    else document.body.classList.remove('is-root-page');

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router.events, router.pathname, router.asPath]);
  
    // [공정 2] 🚨 글로벌 하이퍼링크 인터셉터 (Loading.tsx 트리거용)
    useEffect(() => {
      const handleGlobalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a'); 
  
        if (
          anchor && 
          anchor.href && 
          anchor.target !== '_blank' && 
          !e.defaultPrevented && 
          !e.metaKey && !e.ctrlKey && !e.shiftKey
        ) {
          try {
            const url = new URL(anchor.href, window.location.origin);
            if (url.origin === window.location.origin && url.pathname !== router.asPath) {
              e.preventDefault();
              window.dispatchEvent(new Event('trigger-arc-loading'));
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
  
    // [공정 5] 🚨 사이트 전체 우클릭 방지 (AaRC 보안 엔진)
    useEffect(() => {
      const handleGlobalContextMenu = (e: MouseEvent) => {
        // 텍스트 입력창이나 텍스트 영역에서는 우클릭을 허용하고 싶을 경우 아래 주석을 해제하세요.
        /*
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        */
        e.preventDefault();
      };
  
      window.addEventListener('contextmenu', handleGlobalContextMenu);
      return () => {
        window.removeEventListener('contextmenu', handleGlobalContextMenu);
      };
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