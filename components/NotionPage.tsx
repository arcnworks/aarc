import Swiper from 'swiper'; 
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
// @ts-ignore - swiper v12 CSS imports are not recognized by TypeScript 4.x
import 'swiper/css';
// @ts-ignore
import 'swiper/css/navigation';
// @ts-ignore
import 'swiper/css/pagination';
import dynamic from 'next/dynamic'; 
import Image from 'next/image'; 
import Link from 'next/link'; 
import { useRouter } from 'next/router'; 
import * as React from 'react'; 
import BodyClassName from 'react-body-classname'; 
import { NotionRenderer } from '../packages/react-notion-x'; 
import TweetEmbed from 'react-tweet-embed'; 
import { useSearchParam } from 'react-use'; 
import cs from 'classnames'; 
import * as config from 'lib/config'; 
import { mapImageUrl } from 'lib/map-image-url'; 
import { getCanonicalPageUrl, mapPageUrl } from 'lib/map-page-url'; 
import { searchNotion } from 'lib/search-notion'; 
import * as types from 'lib/types'; 
import { useDarkMode } from 'lib/use-dark-mode'; 
import { PageBlock } from 'notion-types'; 
import { formatDate, getBlockTitle, getPageProperty } from 'notion-utils'; 
import { loadPrismComponentsWithRetry } from '~/lib/load-prism-components'; 
import Comments from './Comments'; 
import { Loading } from './Loading'; 
import { Footer } from './Footer'; 
import { NotionPageHeader, ToggleThemeButton } from './NotionPageHeader'; 
import { Page404 } from './Page404'; 
import { PageAside } from './PageAside'; 
import styles from './styles.module.css'; 





// --- 커스텀 다이어그램(Mermaid) 렌더러 ---
const CustomMermaid = dynamic(() => {
    return Promise.resolve(({ code }: { code: string }) => {
      const ref = React.useRef<HTMLDivElement>(null);
      React.useEffect(() => {
        if (!ref.current) return;
        ref.current.innerHTML = '';
        const textNode = document.createTextNode(code);
        ref.current.appendChild(textNode);
        import('mermaid').then((m) => {
        // m.default 또는 m을 any로 캐스팅하여 구조적 타입 충돌 우회
        const mermaidAPI = (m.default || m) as any;
        
        mermaidAPI.initialize({ 
          startOnLoad: false, 
          theme: 'default', 
          securityLevel: 'loose', 
          flowchart: { useMaxWidth: true, htmlLabels: true } 
        });
        
        mermaidAPI.run({ nodes: [ref.current!] }).catch((e) => console.error('Mermaid error', e));
      });
      }, [code]);
      return (
        <div className="mermaid-wrapper" style={{ width: '100%', margin: '2.5rem 0' }}>
          <style dangerouslySetInnerHTML={{ __html: `.mermaid-render svg { width: 100% !important; height: auto !important; max-width: 100% !important; }` }} />
          <div className="mermaid-render" ref={ref} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>{code}</div>
        </div>
      );
    });
  }, { ssr: false }
);



/* NotionPage.tsx - v83.0 다크모드 동기화 엔진 */

/* NotionPage.tsx - v84.0 에러 UI 및 다크모드 통합 엔진 */

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const LivePreview = ({ code, language, aspectRatio, isDarkMode }: { code: string; language: string; aspectRatio?: string; isDarkMode: boolean }) => {
  const [height, setHeight] = React.useState('150px');
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  useIsomorphicLayoutEffect(() => {
    let parent = iframeRef.current?.parentElement;
    while (parent && !parent.classList.contains('notion-page')) {
      parent.style.setProperty('padding-bottom', '0', 'important');
      parent.style.setProperty('height', 'auto', 'important');
      parent.style.setProperty('aspect-ratio', 'auto', 'important');
      parent = parent.parentElement;
    }

    if (aspectRatio) return; 

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize-iframe' && event.source === iframeRef.current?.contentWindow) {
        setHeight(`${Math.max(event.data.height, 50)}px`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [aspectRatio]);

  // ✅ [핵심 해결책] useEffect의 setTimeout을 제거하고, useMemo로 렌더링 즉시 완성된 HTML을 제공합니다.
  // 이로 인해 iframe이 로드 후 주소가 변경되는 현상을 막아 '뒤로가기 스택 누적'을 원천 차단합니다.
  const srcDoc = React.useMemo(() => {
    let headContent = '<meta charset="utf-8">';
    let bodyContent = '';
    const lang = language?.toLowerCase();
    
    if (lang === 'html') bodyContent = code;
    else if (lang === 'css') {
      headContent += `<style>${code}</style>`;
      bodyContent = `<div style="width:100%; height:300px;"></div>`;
    } else if (lang === 'javascript' || lang === 'js') {
      bodyContent = `
        <div id="js-output"></div>
        <script>
          window.onerror = function(msg, url, line, col, error) {
            if (window.renderError) window.renderError(error || msg);
            return false;
          };
          try { 
            ${code} 
          } catch(e) { 
            if (window.renderError) window.renderError(e); 
          }
        </script>
      `;
    }

    const bgColor = isDarkMode ? '#1f1f1f' : 'transparent';
    const textColor = isDarkMode ? '#ebeced' : '#37352f';
    const errorBg = isDarkMode ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 0, 0, 0.05)';
    const errorBorder = isDarkMode ? '#ff4444' : '#ff0000';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${headContent}
          <style>
           body, html { 
          margin: 0; padding: 0; overflow: clip;     ← clip으로 변경
          background: ${bgColor}; color: ${textColor}; 
          width: 100%; height: auto !important; 
              transition: background 0.3s ease, color 0.3s ease;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            }
            #content-wrapper { display: block; width: 100%; height: auto !important; min-height: 1px; }
            
            /* 🚨 프로페셔널 에러 UI 스타일 */
            #error-boundary {
              margin: 12px; padding: 16px; border-radius: 8px;
              border-left: 4px solid ${errorBorder};
              background: ${errorBg};
              font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
              font-size: 13px; line-height: 1.5;
            }
            .error-title { color: ${errorBorder}; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; }
            .error-title::before { content: '⚠️'; margin-right: 8px; }
            .error-msg { white-space: pre-wrap; word-break: break-all; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div id="content-wrapper">${bodyContent.trim()}</div>
          <script>
            const wrapper = document.getElementById('content-wrapper');
            
            window.renderError = function(e) {
              const errorMsg = e.stack || e.message || e;
              wrapper.innerHTML = \`
                <div id="error-boundary">
                  <div class="error-title">Runtime Error</div>
                  <div class="error-msg">\${errorMsg}</div>
                </div>
              \`;
              sendHeight();
            };

            function sendHeight() {
              const slider = wrapper.querySelector('.swiper') || wrapper;
              const h = Math.ceil(slider.offsetHeight || wrapper.scrollHeight);
              if (h > 0) {
                window.parent.postMessage({ type: 'resize-iframe', height: h }, '*');
              }
            }
            window.addEventListener('load', function() {
              sendHeight();
              setTimeout(sendHeight, 300);
              setTimeout(sendHeight, 1000);
            });
            new ResizeObserver(sendHeight).observe(document.body);
          </script>
        </body>
      </html>
    `;
  }, [code, language, isDarkMode]);

  const cleanRatio = aspectRatio ? aspectRatio.replace(/:/g, '/') : 'auto';

  // NotionPage.tsx 내부의 LivePreview 컴포넌트 return 부분 수정

return (
  <div style={{ width: '100%', margin: '0', overflow: 'hidden' }}>
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      title="preview-output"
      /* ✅ allow-same-origin: iframe 내부의 네트워크 요청이 정상 출처(Origin)를 가질 수 있도록 허용
        ✅ allow-forms, allow-popups: 지도 내부 검색창(Form) 작동 및 링크 클릭 시 새 창 분기 허용
      */
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      /* ✅ allow="geolocation...": 지도 서비스의 생명인 GPS(위치 정보) 및 클립보드 권한을 내부 iframe으로 대물림 
      */
      allow="geolocation; clipboard-write"
      frameBorder="0"
      style={{ 
        display: 'block', 
        width: '100%', 
        aspectRatio: aspectRatio ? cleanRatio : 'auto',
        height: aspectRatio ? 'auto' : height, 
        border: 'none', 
        background: 'transparent', 
        transition: 'height 0.2s ease'
      }}
    />
  </div>
);
};

// --- 서드파티 컴포넌트 로딩 ---
const Code = dynamic(() =>
  import('../packages/react-notion-x/third-party/code').then(async m => {
    await loadPrismComponentsWithRetry([
      () => import('prismjs/components/prism-markup-templating.js'), 
      () => import('prismjs/components/prism-markup.js'), 
      () => import('prismjs/components/prism-bash.js'), 
      () => import('prismjs/components/prism-graphql.js'), 
      () => import('prismjs/components/prism-markdown.js'), 
      () => import('prismjs/components/prism-python.js'), 
      () => import('prismjs/components/prism-java.js'),
      () => import('prismjs/components/prism-javascript.js'),
      () => import('prismjs/components/prism-scss.js'), 
      () => import('prismjs/components/prism-yaml.js'), 
    ]);
    return m.Code; 
  }),
);

const Collection = dynamic(
  () =>
    import('../packages/react-notion-x/third-party/collection').then(
      (m) => m.Collection
    ),
  { ssr: false } // 데이터베이스 렌더링 시 브라우저 환경에서만 동작하도록 설정
)

const Equation = dynamic(() =>
  import('../packages/react-notion-x/third-party/equation').then(
    (m) => m.Equation
  )
)

const Pdf = dynamic(
  () =>
    import('../packages/react-notion-x/third-party/pdf').then((m) => m.Pdf),
  { ssr: false }
)

const Modal = dynamic(
  () =>
    import('../packages/react-notion-x/third-party/modal').then((m) => {
      // Modal 컴포넌트가 존재하고 setAppElement 메서드가 있을 때만 실행
      if (m.Modal?.setAppElement) {
        m.Modal.setAppElement('.notion-viewport')
      }
      return m.Modal
    }),
  { ssr: false }
)

const Tweet = ({ id }: { id: string }) => <TweetEmbed tweetId={id} />

export const NotionPage: React.FC<types.PageProps & { recentPosts?: any[] }> = ({ site, recordMap, error, pageId, draftView, recentPosts }) => {
  
  // 💡 [AaRC 제어판] 여기서 모드를 변경하세요!
  // 'tabs'     -> 카테고리가 한 줄로 나열되는 모드
  // 'dropdown' -> 기존 노션 방식의 드롭다운 모드
  const collectionViewMode: 'tabs' | 'dropdown' = 'tabs'; 

  // 🚨 [AaRC] 데이터베이스(Collection) 리스트 복구 엔진
  if (recordMap) {
    const categories = ['block', 'collection', 'collection_view', 'collection_query'];
    categories.forEach((category) => {
      if (recordMap[category]) {
        Object.keys(recordMap[category]).forEach((key) => {
          const item = recordMap[category][key];
          
          // 1. 일반 블록 및 설정 데이터 해제
          // ✅ [수정] block 카테고리는 언래핑 대상에서 제외합니다.
          // react-notion-x가 block 데이터를 직접 참조하므로,
          // 이중 언래핑 시 toggle·checkbox·quote·수식 등의 블록 구조가 파괴됩니다.
          if (category !== 'block' && item && item.value && item.value.value) {
            item.value = item.value.value;
          }
          
          // 2. Blog/Work 게시글 목록 데이터 해제
          if (category === 'collection_query' && item) {
             Object.keys(item).forEach(viewKey => {
                const viewData = item[viewKey];
                if (viewData && viewData.value && viewData.value.value) {
                   item[viewKey] = viewData.value.value;
                }
             });
          }

          // 3. 💡 [AaRC 추가] 갤러리 커버 호환성 패치 (탭 전환 시 이미지 증발 방지)
          if (category === 'collection_view' && item) {
             if (item.value?.format?.gallery_cover?.type === 'page_content_first') {
                item.value.format.gallery_cover.type = 'page_content';
             }
          }
        });
      }
    });
  }

  const router = useRouter(); 
  const lite = useSearchParam('lite'); 
  const { isDarkMode } = useDarkMode();

  // 💡 [AaRC 추가] 현재 페이지 ID가 사이트 설정상의 루트 ID와 같은지 검사합니다.
  const isRootPage = pageId === site.rootNotionPageId;

  // =========================================================================
  // 1. 검색
  // =========================================================================

  // [상태 관리] 모달 열림 상태, 검색어, 검색 결과, 로딩 상태를 관리합니다.
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // [기능 1] 하이라이트 태그 보완 (에러 방어막 포함)
  const formatHighlight = (text: any) => {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/<gzkNfoUU>/g, '<mark class="arc-mark">')
      .replace(/<\/gzkNfoUU>/g, '</mark>')
      .replace(/<mark>/g, '<mark class="arc-mark">');
  };

  // [기능 2] 이벤트 가로채기 (마우스 클릭 및 단축키 방어)
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const searchBtn = (e.target as HTMLElement).closest('.notion-search-button');
      if (searchBtn) { 
        e.preventDefault(); 
        e.stopPropagation(); 
        setIsSearchOpen(true); 
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'k')) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // [기능 3] 키워드 중심 검색 (단일 로직 적용 - 충돌 및 깜빡임 완벽 방어)
  React.useEffect(() => {
    let isCancelled = false; 

    if (!isSearchOpen || !searchQuery.trim()) { 
      setSearchResults([]); 
      return; 
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch('/api/search-notion', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, ancestorId: site?.rootNotionPageId })
        });
        const data = await res.json();
        
        if (isCancelled) return; 

        if (!data.results || data.results.length === 0) {
          setSearchResults([]);
          return;
        }

        const blockMap = data.recordMap?.block || {};
        const uniqueMap = new Map();

        (data.results || []).forEach((item: any) => {
          const blockId = item.highlightBlockId || item.id;
          if (!blockId) return;

          let currentBlock = blockMap[blockId]?.value || blockMap[item.id]?.value;
          if (!currentBlock) return;

          let pageId = currentBlock.id;
          while (currentBlock) {
            if (currentBlock.type === 'page' || currentBlock.type === 'collection_view_page') {
              pageId = currentBlock.id;
              break;
            }
            if (!currentBlock.parent_id) break;
            currentBlock = blockMap[currentBlock.parent_id]?.value;
          }

          let snippet = '';
          if (item.highlight?.html && typeof item.highlight.html === 'string') {
            snippet = item.highlight.html;
          } else if (item.highlight?.text && typeof item.highlight.text === 'string') {
            snippet = item.highlight.text;
          }

          if (!snippet && currentBlock?.properties?.title) {
            try {
              const fullText = currentBlock.properties.title.map((seg: any) => seg[0]).join('');
              const regex = new RegExp(`(${searchQuery})`, 'gi');
              snippet = fullText.replace(regex, '<mark class="arc-mark">$1</mark>');
            } catch (e) {
              snippet = '';
            }
          }

          if (!snippet || typeof snippet !== 'string' || snippet.trim() === '') {
            snippet = `<mark class="arc-mark">${searchQuery}</mark> 키워드가 포함된 문서입니다.`;
          }

          if (!uniqueMap.has(blockId)) {
            uniqueMap.set(blockId, { id: blockId, pageId: pageId, snippet: snippet });
          }
        });

        if (isCancelled) return;
        const finalResults = Array.from(uniqueMap.values()).slice(0, 20);
        setSearchResults(finalResults);

      } catch (e) { 
        console.error('Search Error:', e); 
      } finally { 
        if (!isCancelled) setIsSearching(false); 
      }
    }, 400); 

    return () => {
      clearTimeout(timer);
      isCancelled = true;
    };
  }, [searchQuery, isSearchOpen, site?.rootNotionPageId]);


  



  


  // =========================================================================
  // [AaRC 이미지 링크 주입] 어제 작동했던 래핑(Wrap) 방식 + 절대경로 버그 완벽 픽스
  // =========================================================================
  React.useEffect(() => {
    if (!recordMap || !recordMap.block) return;

    const blockKeys = Object.keys(recordMap.block);
    const targetBlocks: { shortId: string, link: string }[] = [];
    
    blockKeys.forEach((id) => {
  // 1. 임시로 any 타입으로 캐스팅하여 컴파일러의 엄격한 검사를 우회합니다.
  const rawEntry = recordMap.block[id] as any;
  
  // 2. value가 존재하는 구조면 .value를 쓰고, 없으면 데이터 자체를 block으로 사용합니다.
  const block = rawEntry?.value ?? rawEntry;
  
  if (!block) return;

      const rawString = JSON.stringify(block);
      let link = null;

      link = block?.format?.image_hyperlink || block?.format?.block_link || block?.properties?.caption?.[0]?.[1]?.[0]?.[1];
      
      if (!link && rawString.includes('http')) {
        const urlRegex = /"(https?:\/\/[^"]+)"/g;
        let m;
        while ((m = urlRegex.exec(rawString)) !== null) {
          const url = m[1];
          if (!url.includes('notion.so') && !url.includes('amazonaws.com') && !url.includes('notion-static.com')) {
            link = url;
            break;
          }
        }
      }

      if (link) {
        targetBlocks.push({ shortId: id.replace(/-/g, ''), link });
      }
    });

    const processImages = () => {
      // 1. 전역 우클릭 차단
      const allImageWrappers = document.querySelectorAll('.notion-asset-wrapper-image, .notion-image-block');
      allImageWrappers.forEach((wrapper: any) => {
        if (!wrapper.dataset.arcNoRightClickApplied) {
          wrapper.oncontextmenu = (e: MouseEvent) => { e.preventDefault(); };
          wrapper.dataset.arcNoRightClickApplied = 'true';
        }
      });

      // 2. 이미지 하이퍼링크 주입 및 래핑 (어제 성공 방식 복원)
      targetBlocks.forEach(({ shortId, link }) => {
        const wrappers = document.querySelectorAll(`.notion-block-${shortId}`);
        
        wrappers.forEach((wrapper: any) => {
          if (wrapper.dataset.arcLinkApplied === 'true') return;
          
          const img = wrapper.querySelector('img');
          if (!img || !img.parentElement) return;

          // ✅ 이미 <a> 태그 안에 있는 이미지는 건너뜀 (로고 등 기존 링크 보호)
          if (img.closest('a')) return;

          // ✅ 어제 성공했던 방식: <a> 태그를 생성해 이미지를 안에 넣습니다.
          const a = document.createElement('a');
          a.href = link;
          a.target = '_self'; 
          a.className = 'arc-link-applied';
          a.style.display = 'block';
          a.style.width = '100%';
          a.style.height = '100%';

          a.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 🚨 [AaRC 시공] 이미지 클릭 즉시 로딩 신호 발사!
            window.dispatchEvent(new Event('trigger-arc-loading')); 
            
            try {
              const url = new URL(link, window.location.origin);
              if (url.origin === window.location.origin) {
                // 상대 경로로 깎아내어 라우터 엔진에 태웁니다.
                const relativePath = url.pathname + url.search + url.hash;
                router.push(relativePath);
              } else {
                window.location.href = link;
              }
            } catch (err) {
              router.push(link);
            }
          };
          
          img.style.cursor = 'pointer';
          
          // ✅ 어제 성공했던 물리적 구조: <a>를 img 앞에 넣고, img를 <a> 안으로 이동
          img.parentElement.insertBefore(a, img);
          a.appendChild(img);

          wrapper.dataset.arcLinkApplied = 'true';
        });
      });
    };

    const observer = new MutationObserver(processImages);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = setInterval(processImages, 1000);
    processImages();

    return () => { observer.disconnect(); clearInterval(interval); };
  }, [recordMap, pageId, router]);
  // =========================================================================
// ✅ [AaRC v14.4] 슬라이더 엔진 + 외부 링크 새 창 분기형 보안 우회 수신기
// =========================================================================
React.useEffect(() => {
  // 🚀 [AaRC 보안 우회 수신기] Notion 코드 블록 슬라이더의 이동 신호를 처리합니다.
  const handleSliderMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'arc-slider-navigate') {
      const targetUrl = event.data.url;

      // 🔍 [핵심 수정] URL이 http:// 또는 https://로 시작하는 외부 도메인인지 검사
      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        // 외부 링크는 사용자의 원래 서핑 흐름을 깨지 않도록 새 탭/새 창으로 팝업 오픈
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        // 기존 /work 같은 내부 경로는 기존 기획대로 현재 창 이동 및 로딩 애니메이션 작동
        // 1. 로딩 애니메이션 실행
        window.dispatchEvent(new Event('trigger-arc-loading')); 
        // 2. 부모 창(현재 브라우저) 이동
        router.push(targetUrl);
      }
    }
  };

  // 메시지 리스너 등록
  window.addEventListener('message', handleSliderMessage);

  // 🛡️ [핵심 1. 비파괴 은폐] 리액트가 관리하는 원본 DOM을 파괴하지 않고, CSS로 살짝 가려주기만 합니다.
  if (!document.getElementById('arc-slider-safe-css')) {
    const style = document.createElement('style');
    style.id = 'arc-slider-safe-css';
    style.innerHTML = `
      .arc-slider-applied .notion-callout-text > *:not(.swiper) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  const timer = setTimeout(() => {
    const callouts = document.querySelectorAll('.notion-callout');

    callouts.forEach((callout, index) => {
      if (callout.classList.contains('arc-slider-applied')) return;

      const contentWrapper = callout.querySelector('.notion-callout-text');
      if (!contentWrapper) return;

      // 1️⃣ [명령어 스캔]
      const allText = contentWrapper.textContent || '';
      const regex = /\[slide(?:\s*[:\|]\s*(\d+))?(?:\s*[:\|]\s*([a-zA-Z0-9\./:]+))?\s*\]/i;
      const match = allText.match(regex);

      if (!match) return;

      const delay = match[1] ? parseInt(match[1], 10) : 4000;
      let aspectRatio = match[2] ? match[2].replace(':', '/') : 'auto';

      // 2️⃣ [스와이퍼 뼈대 시공]
      const swiperContainer = document.createElement('div');
      swiperContainer.className = `swiper arc-dom-swiper-${index}`;
      swiperContainer.style.width = '100%';
      swiperContainer.style.overflow = 'hidden';
      swiperContainer.style.paddingBottom = '30px';

      const swiperWrapper = document.createElement('div');
      swiperWrapper.className = 'swiper-wrapper';

      if (aspectRatio !== 'auto') {
        swiperContainer.style.aspectRatio = aspectRatio;
        swiperWrapper.style.height = '100%'; 
      }

      // 3️⃣ [핵심 2. DOM 복제] 원본을 뜯어내지 않고, 똑같은 복제본(Clone)을 뜹니다!
      const rawChildren = Array.from(contentWrapper.children);
      let validCount = 0;

      rawChildren.forEach(child => {
        const clonedChild = child.cloneNode(true) as HTMLElement;

        const eraseCommand = (node: Node) => {
          if (node.nodeType === 3) { 
            if (node.nodeValue) {
              node.nodeValue = node.nodeValue.replace(/\[slide[^\]]*\]/gi, '');
            }
          } else {
            node.childNodes.forEach(c => eraseCommand(c));
          }
        };
        eraseCommand(clonedChild);

        if (clonedChild.textContent?.trim() === '' && !clonedChild.querySelector('img, iframe, video')) {
          return; 
        }

        validCount++;

        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.style.display = 'flex';
        slide.style.justifyContent = 'center';
        slide.style.alignItems = 'center';
        slide.style.width = '100%';
        if (aspectRatio !== 'auto') slide.style.height = '100%';

        if (aspectRatio !== 'auto') {
          const imgs = clonedChild.querySelectorAll('img');
          imgs.forEach(img => {
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            let parent = img.parentElement;
            while (parent && parent !== slide) {
              parent.style.width = '100%';
              parent.style.height = '100%';
              parent.style.pointerEvents = 'none'; // 이미지 자체 클릭 방해 금지
              parent = parent.parentElement;
            }
          });
        }

        slide.appendChild(clonedChild);
        swiperWrapper.appendChild(slide);
      });

      if (validCount === 0) return;

      const pagination = document.createElement('div');
      pagination.className = 'swiper-pagination';
      const prevBtn = document.createElement('div');
      prevBtn.className = 'swiper-button-prev';
      const nextBtn = document.createElement('div');
      nextBtn.className = 'swiper-button-next';

      swiperContainer.appendChild(swiperWrapper);
      swiperContainer.appendChild(pagination);
      swiperContainer.appendChild(prevBtn);
      swiperContainer.appendChild(nextBtn);
      
      contentWrapper.appendChild(swiperContainer);

      const isLoop = validCount >= 2; 
      const autoplayConfig = delay > 0 ? { delay: delay, disableOnInteraction: false } : false;

      new Swiper(`.arc-dom-swiper-${index}`, {
        modules: [Navigation, Pagination, Autoplay],
        navigation: { nextEl: nextBtn, prevEl: prevBtn },
        pagination: { el: pagination, clickable: true },
        autoplay: autoplayConfig,
        loop: isLoop,
        spaceBetween: 20
      });

      callout.classList.add('arc-slider-applied');
    });
  }, 1000);

  return () => {
    // 💡 클린업: 이벤트 리스너와 타이머를 모두 해제합니다.
    window.removeEventListener('message', handleSliderMessage);
    clearTimeout(timer);
  };
}, [recordMap, router.asPath, router]);

  // =========================================================================
  // 💡 [AaRC 최종 완성형 패치] 모든 URL 형태(전체 도메인, 상대경로 등)를 완벽 대응하는 블록 변환기
  // =========================================================================
  const transformNotionLink = React.useCallback((url: string) => {
    if (!url || typeof url !== 'string') return url;

    // 1. 쿼리 매개변수와 해시를 제외한 순수 경로 부분 추출
    const pathname = url.split(/[?#]/)[0];
    
    // 2. 🎯 [정밀 정규식] 전체 URL 포맷이나 서브 디렉토리 포맷에 구애받지 않고 
    // 주소 내부에 숨겨진 32자리 순수 노션 블록 ID 패턴을 완벽하게 추출해 냅니다.
    const match = pathname.match(/[a-f0-9]{32}/i);
    if (!match) return url;

    const cleanId = match[0].toLowerCase();

    // 3. 하이픈(-) 유무 분기 문제를 차단하기 위해 recordMap.block의 모든 키를 압축 포맷으로 전수 조사합니다.
    const targetKey = Object.keys(recordMap?.block || {}).find(
      (key) => key.replace(/-/g, '').toLowerCase() === cleanId
    );
    
    // ✅ value가 이중 래핑된 경우까지 대응
    const rawEntry = (targetKey ? recordMap.block[targetKey] : null) as any;
    const blockValue = rawEntry?.value?.value ?? rawEntry?.value ?? null;

    if (blockValue) {
      // 독립적인 진짜 하위 페이지인 경우: 정상 라우팅
      if (blockValue.type === 'page' || blockValue.type === 'collection_view_page') {
        return url;
      }
      // 인페이지 블록(toggle, header 등): '#id'로 치환해 Next.js 프리페치/라우팅 차단
      return `#${cleanId}`;
    }

    // recordMap에 없는 블록 ID → 진짜 sub-page일 수 있으므로 원본 URL 유지
    return url;
  }, [recordMap]);

  // =========================================================================
  // [기능 5] NotionRenderer용 컴포넌트 매핑 (순정 상태 유지 + 커스텀 기능 복구)
  // =========================================================================
  const components = React.useMemo(() => ({
    nextImage: Image,

    // 🚨 [핵심 수정] react-notion-x 렌더러가 내부 링크 생성을 위해 조회하는 
    // 세 가지 후보군 키(Link, nextLink, PageLink) 전체를 완벽하게 차단막으로 감싸 맵핑합니다.
    Link: ({ href, as, ...rest }: any) => {
      const rawUrl = as !== undefined ? as : href;
      const targetUrl = transformNotionLink(rawUrl || '#');

      // 🎯 변환된 결과가 해시(#) 링크일 경우, Next.js의 <Link> 컴포넌트가 아닌 
      // 순수 HTML <a> 태그로 리턴하여 Next.js가 백그라운드 프리페치(.json 404)를 시도하는 행위를 원천 봉쇄합니다.
      if (targetUrl.startsWith('#')) {
        return <a href={targetUrl} {...rest} />;
      }
      return <Link href={targetUrl} {...rest} />;
    },

    nextLink: ({ href, as, ...rest }: any) => {
      const rawUrl = as !== undefined ? as : href;
      const targetUrl = transformNotionLink(rawUrl || '#');

      if (targetUrl.startsWith('#')) {
        return <a href={targetUrl} {...rest} />;
      }
      return <Link href={targetUrl} {...rest} />;
    },

    /* NotionPage.tsx - Code 컴포넌트 맵핑 수정 */
    Code: (props: any) => {
      const language = props.block?.properties?.language?.[0]?.[0]?.toLowerCase() || props.language?.toLowerCase();
      const captionArray = props.block?.properties?.caption || [];
      const caption = captionArray.map((segment: any) => segment[0]).join('') || '';
      const codeTextArray = props.block?.properties?.title || [];
      const codeText = codeTextArray.map((segment: any) => segment[0]).join('') || '';
      
      if (language === 'mermaid') return <CustomMermaid code={codeText} />;
      
      if (['html', 'css', 'javascript', 'js'].includes(language) && caption.toLowerCase().includes('preview')) {
        const match = caption.match(/preview\s*[:\s]\s*([\d\s/:\.]+)/i);
        let dynamicRatio = undefined;
        if (match) { 
          dynamicRatio = match[1].replace(/\s/g, ''); 
        }
    
        return <LivePreview key={codeText} code={codeText} language={language} aspectRatio={dynamicRatio} isDarkMode={isDarkMode} />;
      }
      return <Code {...props} />;
    },

    Collection, 
    collection: Collection, 
    Equation,
    Pdf, 
    Tweet, 
    Modal,
    Header: NotionPageHeader,
    
    propertyFormulaValue: (props: any, defaultFn: any) => {
      const result = typeof defaultFn === 'function' ? defaultFn() : null;
      if (result) return result;
      try {
        const formulaData = props.data?.[0]?.[1]?.[0]?.[1]?.formula;
        return formulaData?.string || formulaData?.number || props.data?.[0]?.[0] || '';
      } catch (e) { return ''; }
    },
    
    propertyLastEditedTimeValue: ({ block, pageHeader }: any, defaultFn: any) => 
      (pageHeader && block?.last_edited_time) ? `Last updated ${formatDate(block?.last_edited_time, { month: 'long' })}` : defaultFn(),
      
    propertyDateValue: ({ data, schema }: any, defaultFn: any) => {
      if (schema?.name?.includes('연도') && data?.[0]?.[1]?.[0]?.[1]?.start_date) {
          return data?.[0]?.[1]?.[0]?.[1]?.start_date.split('-')[0];
      }
      return defaultFn();
    },
    
    propertyTextValue: ({ schema, pageHeader }: any, defaultFn: any) => 
      (pageHeader && schema?.name?.toLowerCase() === 'author') ? <b>{defaultFn()}</b> : defaultFn(),
      
    PageLink: ({ children, href, as, ...rest }: any) => {
      const rawUrl = as !== undefined ? as : href;
      const targetUrl = transformNotionLink(rawUrl || '#');

      if (targetUrl.startsWith('#')) {
        return <a href={targetUrl} {...rest}>{children}</a>;
      }
      return <Link href={targetUrl} {...rest}>{children}</Link>;
    },
  }), [site, draftView, recordMap, transformNotionLink, isDarkMode]);
  
  

  const isLiteMode = lite === 'true';
  if (router.isFallback) return <Loading />;
  if (error || !site || !recordMap) return <Page404 site={site} pageId={pageId} error={error} />;

  // 1. 최상위 블록 엔트리를 임시로 any 처리합니다.
  const rootBlockEntry = recordMap.block[Object.keys(recordMap.block)[0]] as any;

  // 2. 구조에 따라 .value를 참조하거나 데이터 자체를 block으로 가져옵니다.
  const block = rootBlockEntry?.value ?? rootBlockEntry;

  if (!block) return <Page404 site={site} pageId={pageId} />;
  
  const isBlogPost = block?.type === 'page' && block?.parent_table === 'collection';
  const pageAside = <PageAside block={block} recordMap={recordMap} isBlogPost={isBlogPost} recentPosts={recentPosts} />;

  // ... (이전 코드들: const pageAside = ... 등)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* [AaRC 통합 탭 디자인] */
        .arc-use-tabs .notion-collection-header {
          height: auto !important;
          overflow: visible !important; /* 💡 가려진 글자 해방 */
          padding-bottom: 8px !important;
        }

        .arc-use-tabs .arc-collection-tabs-row {
          display: flex !important;
          flex-direction: row !important; /* 💡 가로 나열 강제 */
          flex-wrap: wrap !important;
          gap: 32px !important;
          border-bottom: 1px solid rgba(150, 150, 150, 0.15) !important;
        }

        .arc-use-tabs .arc-tab-item {
          cursor: pointer !important;
          padding: 0px 0 4px 0 !important;
          border-bottom: 2px solid transparent !important;
          margin-bottom: -1px !important;
        }

        .arc-use-tabs .arc-tab-title {
          font-size: 14px !important;
          color: var(--fg-color) !important;
          opacity: 0.5;
          font-weight: 500 !important;
        }

        .arc-use-tabs .arc-tab-item-active {
          border-bottom: 2px solid var(--fg-color) !important;
        }

        .arc-use-tabs .arc-tab-item-active .arc-tab-title {
          opacity: 1 !important;
          font-weight: 600 !important;
        }

        /* 아이콘 제거 */
        .notion-collection-view-type-icon { display: none !important; }


        /* 🚨 [여기 추가] 토글 버튼 클릭 시 백그라운드 404 라우팅 에러 방어 */
        .notion-toggle > summary {
          position: relative;
          z-index: 10; 
        }

        .notion-toggle a.notion-hash-link {
          pointer-events: none !important; 
        }

      `}} />

      

      {isLiteMode && <BodyClassName className="notion-lite" />}
      {isRootPage && <BodyClassName className="is-root-page" />}

      {/* 검색 모달 UI */}
      {isSearchOpen && (
        <div className="arc-search-backdrop" onClick={() => setIsSearchOpen(false)}>
          <div className="arc-search-modal" onClick={e => e.stopPropagation()}>
            <div className="arc-search-header">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input autoFocus placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <button className="arc-close-btn" onClick={() => setIsSearchOpen(false)}>✕</button>
            </div>
            
            <div className="arc-search-body">
              {isSearching && searchResults.length === 0 && (
                <div className="arc-search-msg">분석 중...</div>
              )}
              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="arc-search-msg">관련 키워드를 찾지 못했습니다.</div>
              )}
              
              <div style={{ opacity: isSearching ? 0.4 : 1, transition: 'opacity 0.2s', pointerEvents: isSearching ? 'none' : 'auto' }}>
                {searchResults.map((r, i) => (
                  <div key={i} className="arc-search-item" onClick={() => { 
                    setIsSearchOpen(false); 
                    router.push(`/${(r.pageId || r.id).replace(/-/g, '')}`); 
                  }}>
                    <div className="arc-search-snippet" 
                         style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.95rem', color: 'var(--fg-color)', lineHeight: '1.6' }} 
                         dangerouslySetInnerHTML={{ __html: formatHighlight(r.snippet) }} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-color-3)', marginTop: '12px', textAlign: 'right' }}>
                      문서 본문 보기 →
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 메인 노션 렌더러 */}
      <div className={collectionViewMode === 'tabs' ? 'arc-use-tabs' : 'arc-use-dropdown'}>
  <NotionRenderer
    darkMode={isDarkMode}
    components={components}
    recordMap={recordMap}
    rootPageId={site.rootNotionPageId}
    rootDomain={site.domain}
    fullPage={!isLiteMode}
    previewImages={!!recordMap.preview_images}
    showCollectionViewDropdown={true}
    showTableOfContents={true}
    minTableOfContentsItems={1}
    
    mapPageUrl={mapPageUrl(site, recordMap, new URLSearchParams(lite ? { lite } : {}), draftView)}
    mapImageUrl={mapImageUrl}
    searchNotion={config.isSearchEnabled ? searchNotion : undefined}
    pageAside={pageAside}
    pageFooter={config.enableComment && isBlogPost && <Comments pageId={block.id} recordMap={recordMap} />}
    footer={<Footer />}
  />
</div>
    </>
  );
};