import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

// ARC 브랜드의 알파벳 'a' 가중치 매트릭스
const coreMatrix = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
  [0, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0, 0],
  [0, 0, 1, 4, 4, 4, 4, 4, 3, 1, 0, 0, 0],
  [0, 0, 3, 4, 2, 1, 2, 4, 4, 1, 0, 0, 0],
  [0, 0, 2, 2, 0, 0, 0, 3, 4, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 4, 4, 1, 0, 0, 0],
  [0, 0, 1, 3, 4, 4, 4, 4, 4, 1, 0, 0, 0],
  [0, 0, 4, 4, 4, 2, 1, 3, 4, 1, 0, 0, 0],
  [0, 0, 4, 4, 1, 0, 0, 2, 4, 1, 0, 0, 0],
  [0, 0, 4, 4, 1, 0, 0, 3, 4, 1, 3, 3, 0],
  [0, 0, 3, 4, 3, 1, 2, 4, 4, 4, 4, 2, 0],
  [0, 0, 1, 4, 4, 4, 4, 4, 4, 2, 1, 0, 0],
  [0, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] 
];

const radiusScale: Record<number, number> = { 1: 1.8, 2: 2.8, 3: 3.8, 4: 4.8 };
const coreCols = 13;
const coreRows = 14;
const spacing = 10;

export const Loading: React.FC = () => {
  const router = useRouter();
  const isFallback = router.isFallback;

  const [isVisible, setIsVisible] = useState(false);
  const [isRouteChanging, setIsRouteChanging] = useState(false);
  const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleStart = (url: string) => {
      if (url === router.asPath) return;
      setIsRouteChanging(true);
      setIsMinTimeElapsed(false);
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      timerRef.current = setTimeout(() => { setIsMinTimeElapsed(true); }, 400); 
    };

    const handleComplete = () => { setIsRouteChanging(false); };
    const forceLoading = () => handleStart('/forced-loading-path');

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    // 🚨 [AaRC 시공] 외부 강제 신호를 받기 위해 귀를 엽니다.
    window.addEventListener('trigger-arc-loading', forceLoading);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
      window.removeEventListener('trigger-arc-loading', forceLoading); // 철거 시에도 깔끔하게
    };
  }, [router.events, router.asPath]);

  useEffect(() => {
    // [핵심 변경] 뒷단 빌드 완료 여부(!isRouteChanging) 조건을 삭제했습니다.
    // 오직 타이머가 다 돌았는지(isMinTimeElapsed)만 판단하여 무조건 화면을 엽니다.
    if (!isFallback && isMinTimeElapsed && isVisible) {
      fadeTimerRef.current = setTimeout(() => {
        setIsVisible(false);
        document.body.style.overflow = '';
      }, 400); 
    }
  }, [isFallback, isMinTimeElapsed, isVisible]);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    if (isVisible || isFallback) {
      updateDimensions();
      window.addEventListener('resize', updateDimensions); 
    }
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isVisible, isFallback]);

  const shouldShow = isFallback || isVisible;
  if (!shouldShow) return null;

  const { width, height } = dimensions;
  if (width === 0 || height === 0) return <div className="arc-fullscreen-loader"></div>;

  const cols = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;
  const startX = Math.floor((cols - coreCols) / 2);
  const startY = Math.floor((rows - coreRows) / 2);

  return (
    <div className={`arc-fullscreen-loader ${!isFallback && isMinTimeElapsed ? 'fade-out' : ''}`}>
      <style jsx global>{`
        .arc-fullscreen-loader {
          position: fixed; 
          top: 0; 
          left: 0;
          z-index: 99999; 
          width: 100vw;
          height: 100dvh; 
          background: rgba(255, 255, 255, 0.75);
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: opacity 0.4s ease-in-out;
        }
        .arc-fullscreen-loader.fade-out {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
      
      <svg viewBox={`0 0 ${cols * spacing} ${rows * spacing}`} style={{ width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: rows + 1 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" y1={i * spacing} x2={cols * spacing} y2={i * spacing} stroke="#aaddff" strokeWidth="0.5" strokeOpacity="0.4" />
        ))}
        {Array.from({ length: cols + 1 }).map((_, j) => (
          <line key={`v-${j}`} x1={j * spacing} y1="0" x2={j * spacing} y2={rows * spacing} stroke="#aaddff" strokeWidth="0.5" strokeOpacity="0.4" />
        ))}
        {coreMatrix.map((row, y) => row.map((weight, x) => (
          weight > 0 && <circle key={`dot-${x}-${y}`} cx={(startX + x) * spacing} cy={(startY + y) * spacing} r={radiusScale[weight]} fill="#0055ff" />
        )))}
      </svg>
    </div>
  );
};