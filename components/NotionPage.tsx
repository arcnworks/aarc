import Swiper from 'swiper'; 
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import dynamic from 'next/dynamic'; 
import Image from 'next/image'; 
import Link from 'next/link'; 
import { useRouter } from 'next/router'; 
import * as React from 'react'; 
import BodyClassName from 'react-body-classname'; 
import { NotionRenderer } from 'react-notion-x'; 
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



const Modal = dynamic(
  () =>
    import('react-notion-x/third-party/modal').then(m => {
      m.Modal.setAppElement('.notion-viewport');
      return m.Modal;
    }),
  {
    ssr: false,
  },
);

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
          const mermaidAPI = m.default || m;
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
  const [srcDoc, setSrcDoc] = React.useState('');
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

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      let headContent = '<meta charset="utf-8">';
      let bodyContent = '';
      const lang = language?.toLowerCase();
      
      if (lang === 'html') bodyContent = code;
      else if (lang === 'css') {
        headContent += `<style>${code}</style>`;
        bodyContent = `<div style="width:100%; height:300px;"></div>`;
      } else if (lang === 'javascript' || lang === 'js') {
        // 💡 [에러 핸들링] 스크립트 실행 전역에서 발생하는 모든 에러를 포착하도록 구성
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

      setSrcDoc(`
        <!DOCTYPE html>
        <html>
          <head>
            ${headContent}
            <style>
              body, html { 
                margin: 0; padding: 0; overflow: hidden; 
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
              
              // 💡 에러 UI 렌더링 엔진
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
                window.parent.postMessage({ type: 'resize-iframe', height: h }, '*');
              }
              window.onload = () => { sendHeight(); setTimeout(sendHeight, 500); };
              new ResizeObserver(sendHeight).observe(document.body);
            </script>
          </body>
        </html>
      `);
    }, 300);
    return () => clearTimeout(timeout);
  }, [code, language, isDarkMode]);

  const cleanRatio = aspectRatio ? aspectRatio.replace(/:/g, '/') : 'auto';

  return (
    <div style={{ width: '100%', margin: '0', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title="preview-output"
        sandbox="allow-scripts"
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
  import('react-notion-x/third-party/code').then(async m => {
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
  () => import('react-notion-x/third-party/collection').then(m => m.Collection),
  { ssr: false } // 이 줄을 추가합니다!
);
const Equation = dynamic(() => import('react-notion-x/third-party/equation').then(m => m.Equation)); 
const Pdf = dynamic(() => import('react-notion-x/third-party/pdf').then(m => m.Pdf), { ssr: false });
const Tweet = ({ id }: { id: string }) => <TweetEmbed tweetId={id} />;

export const NotionPage: React.FC<types.PageProps & { recentPosts?: any[] }> = ({ site, recordMap, error, pageId, draftView, recentPosts }) => {
  const router = useRouter(); 
  const lite = useSearchParam('lite'); 
  const { isDarkMode } = useDarkMode();

  // 💡 [AaRC 추가] 현재 페이지 ID가 사이트 설정상의 루트 ID와 같은지 검사합니다.
  const isRootPage = pageId === site.rootNotionPageId;

  // =========================================================================
  // 📍 [필터 상태 추가] 탭 전환 시에도 필터 정보를 유지하기 위해 여기에 넣습니다.
  // =========================================================================
  // [AaRC 시공 1] URL에서 탭 정보를 읽어오되, 없으면 '모두보기'를 기본값으로 설정합니다.
  const tabFromUrl = router.query.tab as string;
  const [activeFilter, setActiveFilter] = React.useState(tabFromUrl || '모두보기');

  // [AaRC 시공 2] 페이지 경로가 바뀌거나 탭 파라미터가 사라지면(다른 페이지에서 돌아올 때) 리셋합니다.
  React.useEffect(() => {
    if (!tabFromUrl) {
      setActiveFilter('모두보기');
    } else if (tabFromUrl !== activeFilter) {
      setActiveFilter(tabFromUrl);
    }
  }, [tabFromUrl, router.asPath]); // 경로(asPath) 변화를 감지하여 리셋 집행

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
  // [collection view tab] 예외 처리가 강화된 무결성 엔진
  // =========================================================================
  React.useEffect(() => {
    let observer: MutationObserver | null = null;

    const runSurgicalWork = () => {
      const grid = document.querySelector('.notion-gallery-grid');
      const cards = Array.from(document.querySelectorAll('.notion-collection-card'));
      const tabs = Array.from(document.querySelectorAll('.notion-collection-view-tab, .notion-collection-view-tabs-content-item'));
      
      // [1] 돔이 준비되지 않았거나 갤러리가 없는 페이지(Home, Blog 등)라면 즉시 종료합니다.
      if (!grid || cards.length === 0) return;

      if (observer) observer.disconnect();

      // [2] 라이브러리 뷰 강제 동기화 (오류 방지 로직 보완)
      if (activeFilter === '모두보기' && tabs.length > 0) {
        const allTab: any = tabs.find(t => t.textContent?.includes('모두보기'));
        
        // ✅ [안전장치 추가] allTab이 실제로 존재할 때만 스타일을 측정합니다.
        if (allTab) {
          const style = window.getComputedStyle(allTab);
          const isNotAllTabActive = !allTab.classList.contains('notion-collection-view-tab-active') && 
                                    style.borderBottomWidth === '0px';
          
          if (isNotAllTabActive) {
             allTab.click(); 
             return; 
          }
        }
      }

      const isShowAll = ['모두보기', 'All', '전체'].some(k => activeFilter.includes(k));

      // [3] 고속 필터링 집행
      cards.forEach((card: any) => {
        const text = card.innerText || '';
        const shouldShow = isShowAll || text.includes(activeFilter);
        if (card.style.display !== (shouldShow ? '' : 'none')) {
          card.style.display = shouldShow ? '' : 'none';
        }
      });

      // [4] 최신순 정렬 집행
      const sorted = [...cards].sort((a: any, b: any) => {
        const dateA = a.innerText.match(/\d{4}([./]\d{2}[./]\d{2})?/)?.[0] || '0000';
        const dateB = b.innerText.match(/\d{4}([./]\d{2}[./]\d{2})?/)?.[0] || '0000';
        return dateB.localeCompare(dateA); 
      });

      // [5] DOM 재배치 최적화
      sorted.forEach((card, idx) => {
        if (grid.children[idx] !== card) grid.appendChild(card);
      });

      if (observer) observer.observe(document.body, { childList: true, subtree: true });
    };

    // [6] 탭 클릭 핸들러 (안전장치 보강)
    const handleTabClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tab = target.closest('.notion-collection-view-tab, .notion-collection-view-tabs-content-item');
      if (tab) {
        const name = tab.textContent?.trim() || '';
        if (name && name !== activeFilter) {
          router.push({ query: { ...router.query, tab: name } }, undefined, { shallow: true });
          setActiveFilter(name);
        }
      }
    };

    document.addEventListener('click', handleTabClick, true);
    observer = new MutationObserver((m) => {
      if (m.some(mut => mut.addedNodes.length > 0)) runSurgicalWork();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    runSurgicalWork();

    return () => {
      document.removeEventListener('click', handleTabClick, true);
      if (observer) observer.disconnect();
    };
  }, [recordMap, activeFilter, router.asPath]);


  // =========================================================================
  // [AaRC 이미지 링크 주입] 어제 작동했던 래핑(Wrap) 방식 + 절대경로 버그 완벽 픽스
  // =========================================================================
  React.useEffect(() => {
    if (!recordMap || !recordMap.block) return;

    const blockKeys = Object.keys(recordMap.block);
    const targetBlocks: { shortId: string, link: string }[] = [];
    
    blockKeys.forEach((id) => {
      const block = recordMap.block[id]?.value;
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
      });;
    };

    const observer = new MutationObserver(processImages);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = setInterval(processImages, 1000);
    processImages();

    return () => { observer.disconnect(); clearInterval(interval); };
  }, [recordMap, pageId, router]);

  // =========================================================================
  // ✅ [AaRC v14.3] 슬라이더 엔진
  // =========================================================================
  React.useEffect(() => {
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
          // 노드 복제 (리액트 트리 붕괴 방지)
          const clonedChild = child.cloneNode(true) as HTMLElement;

          // 복제본의 텍스트에서만 명령어를 감쪽같이 지웁니다. 원본은 전혀 건드리지 않습니다.
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

          // 명령어가 지워지고 껍데기만 남은 텍스트 블록은 슬라이드에 넣지 않습니다.
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
                parent = parent.parentElement;
              }
            });
          }

          slide.appendChild(clonedChild);
          swiperWrapper.appendChild(slide);
        });

        if (validCount === 0) return;

        console.log(`🛠️ AaRC 격리형 슬라이더 가동: ${validCount}개 요소`);

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
        
        // 원본 자식들을 건드리지 않고 스와이퍼 덩어리를 덧붙입니다.
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

        // 꼬리표 부착 (위에서 시공한 전역 CSS가 원본 요소들을 안전하게 숨겨줍니다)
        callout.classList.add('arc-slider-applied');
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [recordMap, router.asPath]);


  // =========================================================================
  // [기능 5] NotionRenderer용 컴포넌트 매핑 (순정 상태 유지 + 커스텀 기능 복구)
  // =========================================================================
  const components = React.useMemo(() => ({
    // 🚨 이미지 이동은 전역 로직에서 처리하므로 가장 순수한 기본 컴포넌트만 연결합니다.
    nextImage: Image,

    // 🚨 nextLink 로직 복구
    nextLink: ({ href, as, ...rest }: any) => {
      const targetUrl = as !== undefined ? (as || '#') : (href || '#');
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
    
        // 💡 [수정] isDarkMode를 LivePreview로 전달합니다.
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
    
    propertyLastEditedTimeValue: ({ block, pageHeader }, defaultFn: any) => 
      (pageHeader && block?.last_edited_time) ? `Last updated ${formatDate(block?.last_edited_time, { month: 'long' })}` : defaultFn(),
      
    propertyDateValue: ({ data, schema }, defaultFn: any) => {
      if (schema?.name?.includes('연도') && data?.[0]?.[1]?.[0]?.[1]?.start_date) {
          return data?.[0]?.[1]?.[0]?.[1]?.start_date.split('-')[0];
      }
      return defaultFn();
    },
    
    propertyTextValue: ({ schema, pageHeader }, defaultFn: any) => 
      (pageHeader && schema?.name?.toLowerCase() === 'author') ? <b>{defaultFn()}</b> : defaultFn(),
      
    PageLink: ({ children, href, as, ...rest }: any) => {
      const targetUrl = as !== undefined ? (as || '#') : (href || '#');
      return <Link href={targetUrl} {...rest}>{children}</Link>;
    },
  }), [site, draftView, recordMap]);
  
  

  const isLiteMode = lite === 'true';
  if (router.isFallback) return <Loading />;
  if (error || !site || !recordMap) return <Page404 site={site} pageId={pageId} error={error} />;

  const block = recordMap.block[Object.keys(recordMap.block)[0]]?.value;
  if (!block) return <Page404 site={site} pageId={pageId} />;
  
  const isBlogPost = block?.type === 'page' && block?.parent_table === 'collection';
  const pageAside = <PageAside block={block} recordMap={recordMap} isBlogPost={isBlogPost} recentPosts={recentPosts} />;

  return (
    <>
      
      {isLiteMode && <BodyClassName className="notion-lite" />}
      {isRootPage && <BodyClassName className="is-root-page" />}
      {/* ========================================================================= */}
        {/* 2. 키워드 중심 커스텀 모달 UI 및 스타일 (Collection 특화) */}
        {/* ========================================================================= */}
        {isSearchOpen && (
          <div className="arc-search-backdrop" onClick={() => setIsSearchOpen(false)}>
            <div className="arc-search-modal" onClick={e => e.stopPropagation()}>
              
              <div className="arc-search-header">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input autoFocus placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <button className="arc-close-btn" onClick={() => setIsSearchOpen(false)}>✕</button>
              </div>
              
              <div className="arc-search-body">
                {/* 로딩 표시 */}
                {isSearching && searchResults.length === 0 && (
                  <div className="arc-search-msg">분석 중...</div>
                )}
                {/* 결과 없음 표시 */}
                {!isSearching && searchQuery && searchResults.length === 0 && (
                  <div className="arc-search-msg">관련 키워드를 찾지 못했습니다.</div>
                )}
                
                {/* 검색 결과 깜빡임 방지 처리 */}
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

        

      {/* ========================================================================= */}
      
      <NotionRenderer
      darkMode={isDarkMode}
      components={components}
      recordMap={recordMap}
      rootPageId={site.rootNotionPageId}
      rootDomain={site.domain}
      fullPage={!isLiteMode}
      previewImages={!!recordMap.preview_images}
      // --- 데이터베이스 뷰 관련 핵심 설정 ---
      showCollectionViewDropdown={true} // 탭/드롭다운 메뉴 활성화
      showTableOfContents={true} // ✅ 무조건 목차를 생성하도록 강제합니다.
      minTableOfContentsItems={1}
      isImageZoomable={false}
      mapPageUrl={mapPageUrl(site, recordMap, new URLSearchParams(lite ? { lite } : {}), draftView)}
      mapImageUrl={mapImageUrl}
      searchNotion={config.isSearchEnabled ? searchNotion : undefined}
      pageAside={pageAside}
      pageFooter={config.enableComment && isBlogPost && <Comments pageId={block.id} recordMap={recordMap} />}
      footer={<Footer />}
      />
    </>
  );
};