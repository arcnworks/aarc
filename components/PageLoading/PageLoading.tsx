import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

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

export const PageLoading: React.FC = () => {
  const router = useRouter();
  const [isRouteChanging, setIsRouteChanging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleStart = () => setIsRouteChanging(true);
    const handleComplete = () => setIsRouteChanging(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    
    if (isRouteChanging) {
      updateDimensions(); 
      window.addEventListener('resize', updateDimensions); 
    }
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isRouteChanging]);

  if (!isRouteChanging) return null;

  const { width, height } = dimensions;
  if (width === 0 || height === 0) return null;

  const cols = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;
  const startX = Math.floor((cols - coreCols) / 2);
  const startY = Math.floor((rows - coreRows) / 2);

  const horizontalLines = [];
  for (let i = 0; i <= rows; i++) {
    horizontalLines.push(
      <line key={`h-${i}`} x1="0" y1={i * spacing} x2={cols * spacing} y2={i * spacing} stroke="#aaddff" strokeWidth="0.5" strokeOpacity="0.5" />
    );
  }

  const verticalLines = [];
  for (let j = 0; j <= cols; j++) {
    verticalLines.push(
      <line key={`v-${j}`} x1={j * spacing} y1="0" x2={j * spacing} y2={rows * spacing} stroke="#aaddff" strokeWidth="0.5" strokeOpacity="0.5" />
    );
  }

  const dots = [];
  for (let y = 0; y < coreRows; y++) {
    for (let x = 0; x < coreCols; x++) {
      const weight = coreMatrix[y][x];
      if (weight > 0) {
        const cx = (startX + x) * spacing;
        const cy = (startY + y) * spacing;
        dots.push(
          <circle 
            key={`dot-${x}-${y}`} 
            cx={cx} cy={cy} r={radiusScale[weight]} 
            fill="#0055ff" className="grid-dot" 
          />
        );
      }
    }
  }

  return (
    <div className="arc-fullscreen-loader">
      <style jsx>{`
        .arc-fullscreen-loader {
          position: fixed; 
          top: 0;
          left: 0;
          z-index: 99999; 
          width: 100vw;
          height: 100vh; 
          background: rgba(255, 255, 255, 0.9);
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          /* 나타날 때의 깜빡임만 방지하기 위해 0.15초의 짧은 페이드인 유지 */
          animation: fadeIn 0.15s ease-in-out; 
        }
        .blueprint-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        /* 동그라미의 애니메이션 코드를 완전히 철거했습니다 */
        .grid-dot { }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      
      <svg viewBox={`0 0 ${cols * spacing} ${rows * spacing}`} className="blueprint-svg" xmlns="http://www.w3.org/2000/svg">
        {horizontalLines}
        {verticalLines}
        {dots}
      </svg>
    </div>
  );
};

export default PageLoading;