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

const LivePreview = ({ code, language, aspectRatio }: { code: string; language: string; aspectRatio?: string }) => {
  const [height, setHeight] = React.useState('150px');
  const [srcDoc, setSrcDoc] = React.useState('');
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // [공정 1] 동적 높이 조절 (비례 설정이 없을 때만 작동)
  React.useEffect(() => {
    if (aspectRatio) return; 

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize-iframe' && event.source === iframeRef.current?.contentWindow) {
        setHeight(`${Math.max(event.data.height, 100)}px`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [aspectRatio]);

  // [공정 2] 내부 콘텐츠(srcDoc) 생성 로직
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
        bodyContent = `<div id="js-output"></div><script>try { ${code} } catch(e) { document.body.innerHTML = e.message; }</script>`;
      }

      setSrcDoc(`
        <!DOCTYPE html>
        <html>
          <head>
            ${headContent}
            <style>
              body, html { margin: 0; padding: 0; font-family: sans-serif; overflow: hidden; background: transparent; width: 100%; height: 100%; }
              #content-wrapper { display: block; width: 100%; height: 100%; min-height: 10px; }
            </style>
          </head>
          <body>
            <div id="content-wrapper">${bodyContent}</div>
            <script>
              function sendHeight() {
                const wrapper = document.getElementById('content-wrapper');
                const h = wrapper.scrollHeight || wrapper.offsetHeight;
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
  }, [code, language]);

  return (
    <div style={{ width: '100%', margin: '1.5rem 0', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title="preview-output"
        sandbox="allow-scripts"
        frameBorder="0"
        style={{ 
          display: 'block', 
          width: '100%', 
          // 🏗️ [핵심 수정] aspect-ratio를 iframe에 직접 걸고, height를 auto로 설정하여 0이 되는 것을 방지합니다.
          aspectRatio: aspectRatio || 'auto',
          height: aspectRatio ? 'auto' : height, 
          border: 'none', 
          background: '#fff',
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
  // [기능 5] NotionRenderer용 컴포넌트 매핑 (순정 상태 유지 + 커스텀 기능 복구)
  // =========================================================================
  const components = React.useMemo(() => ({
    // 🚨 이미지 이동은 전역 로직에서 처리하므로 가장 순수한 기본 컴포넌트만 연결합니다.
    nextImage: Image,

    // 🚨 과거에 잘 작동했던 nextLink 로직 복구
    nextLink: ({ href, as, ...rest }: any) => {
      const targetUrl = as !== undefined ? (as || '#') : (href || '#');
      return <Link href={targetUrl} {...rest} />;
    },

    // 🚨 과거에 잘 작동했던 Mermaid 및 LivePreview 코드 렌더러 복구
    Code: (props: any) => {
      const language = props.block?.properties?.language?.[0]?.[0]?.toLowerCase() || props.language?.toLowerCase();
      const codeText = props.block?.properties?.title?.[0]?.[0] || '';
      const caption = props.block?.properties?.caption?.[0]?.[0] || '';
      
      if (language === 'mermaid') return <CustomMermaid code={codeText} />;
      
      if (['html', 'css', 'javascript', 'js'].includes(language) && caption.toLowerCase().includes('preview')) {
        // 💡 정규식 보강: preview:900, preview : 900, preview 900 모두 인식 가능하게 수정
        const match = caption.match(/preview\s*[:\s]\s*(\d+)/i);
        const dynamicRatio = match ? `1440 / ${match[1]}` : undefined;

        return <LivePreview code={codeText} language={language} aspectRatio={dynamicRatio} />;
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

        {/* 커스텀 모달 디자인 스타일 (이전에 넣으셨던 것과 동일) */}
        <style dangerouslySetInnerHTML={{ __html: `
          .notion-search-overlay, .notion-search { display: none !important; }
          .arc-search-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); z-index: 100000; display: flex; justify-content: center; padding-top: 10vh; }
          .arc-search-modal { background: var(--bg-color); width: 90%; max-width: 650px; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; border: 1px solid var(--fg-color-1); display: flex; flex-direction: column; max-height: 75vh; }
          .arc-search-header { display: flex; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--fg-color-1); gap: 14px; }
          .arc-search-header input { flex: 1; background: transparent; border: none; color: var(--fg-color); font-size: 1.25rem; outline: none; font-weight: 300; }
          .arc-close-btn { background: transparent; border: none; font-size: 20px; color: var(--fg-color-3); cursor: pointer; padding: 4px; }
          .arc-search-body { overflow-y: auto; padding: 12px 0; }
          .arc-search-item { padding: 20px 24px; cursor: pointer; border-bottom: 1px solid var(--fg-color-0); border-left: 4px solid transparent; transition: all 0.2s; }
          .arc-search-item:hover { background: var(--fg-color-1); border-left: 4px solid var(--primary-color); }
          .arc-search-snippet { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
          .arc-mark { background: #fff5b1 !important; color: #000 !important; padding: 0 3px !important; border-radius: 2px !important; font-weight: 700 !important; box-shadow: 0 0 5px rgba(255, 245, 177, 0.8); }
          .dark-mode .arc-mark { background: #ffd33d !important; }
          .arc-search-msg { padding: 50px; text-align: center; color: #888888 !important; }
        `}} />

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