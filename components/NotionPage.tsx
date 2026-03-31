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

const Code = dynamic(() =>
  import('react-notion-x/third-party/code').then(async m => {
    await loadPrismComponentsWithRetry([
      () => import('prismjs/components/prism-markup-templating.js'), 
      () => import('prismjs/components/prism-markup.js'), 
      () => import('prismjs/components/prism-bash.js'), 
      () => import('prismjs/components/prism-graphql.js'), 
      () => import('prismjs/components/prism-markdown.js'), 
      () => import('prismjs/components/prism-python.js'), 
      () => import('prismjs/components/prism-reason.js'), 
      () => import('prismjs/components/prism-scss.js'), 
      () => import('prismjs/components/prism-sql.js'), 
      () => import('prismjs/components/prism-yaml.js'), 
    ]);
    return m.Code; 
  }),
);

const Collection = dynamic(() => import('react-notion-x/third-party/collection').then(m => m.Collection));
const Equation = dynamic(() => import('react-notion-x/third-party/equation').then(m => m.Equation)); 
const Pdf = dynamic(() => import('react-notion-x/third-party/pdf').then(m => m.Pdf), { ssr: false });
const Modal = dynamic(() => import('react-notion-x/third-party/modal').then(m => { m.Modal.setAppElement('.notion-viewport'); return m.Modal; }), { ssr: false });
const Tweet = ({ id }: { id: string }) => <TweetEmbed tweetId={id} />;

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
          mermaidAPI.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', flowchart: { useMaxWidth: true, htmlLabels: true } });
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

const LivePreview = ({ code, language }: { code: string; language: string }) => {
  const [height, setHeight] = React.useState('150px');
  const [srcDoc, setSrcDoc] = React.useState('');
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize-iframe' && event.source === iframeRef.current?.contentWindow) {
        const newHeight = Math.max(event.data.height, 100);
        setHeight(`${newHeight}px`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      let headContent = '<meta charset="utf-8">';
      let bodyContent = '';

      if (language === 'html') {
        bodyContent = code;
      } else if (language === 'css') {
        // [핵심 수정] CSS 테스트를 위해 300px 높이의 투명 도화지를 자동 생성합니다.
        headContent += `<style>${code}</style>`;
        bodyContent = `<div style="width:100%; height:300px;"></div>`;
      } else if (language === 'javascript' || language === 'js') {
        bodyContent = `<div id="js-output"></div><script>try { ${code} } catch(e) { document.body.innerHTML = e.message; }</script>`;
      }

      setSrcDoc(`
        <!DOCTYPE html>
        <html>
          <head>
            ${headContent}
            <style>
              body { margin: 0; padding: 0; font-family: sans-serif; overflow: hidden; background: transparent; }
              #content-wrapper { display: block; width: 100%; min-height: 10px; }
            </style>
          </head>
          <body>
            <div id="content-wrapper">${bodyContent}</div>
            <script>
              function sendHeight() {
                const wrapper = document.getElementById('content-wrapper');
                const height = wrapper.scrollHeight || wrapper.offsetHeight;
                window.parent.postMessage({ type: 'resize-iframe', height: height }, '*');
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
    <div style={{ width: '100%', margin: '1.5rem 0', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        title="preview-output"
        sandbox="allow-scripts"
        frameBorder="0"
        width="100%"
        style={{ display: 'block', width: '100%', height: height, transition: 'height 0.2s ease', border: 'none' }}
      />
    </div>
  );
};

export const NotionPage: React.FC<types.PageProps & { recentPosts?: any[] }> = ({ site, recordMap, error, pageId, draftView, recentPosts }) => {
  const router = useRouter(); 
  const lite = useSearchParam('lite'); 
  const { isDarkMode } = useDarkMode();

  const components = React.useMemo(() => ({
      nextImage: Image,
      nextLink: ({ href, as, ...rest }: any) => {
        const targetUrl = as !== undefined ? (as || '#') : (href || '#');
        return <Link href={targetUrl} {...rest} />;
      },
      Code: (props: any) => {
        const language = props.block?.properties?.language?.[0]?.[0]?.toLowerCase() || props.language?.toLowerCase();
        const codeText = props.block?.properties?.title?.[0]?.[0] || '';
        const caption = props.block?.properties?.caption?.[0]?.[0];
        if (language === 'mermaid') return <CustomMermaid code={codeText} />;
        const previewLanguages = ['html', 'css', 'javascript', 'js'];
        if (previewLanguages.includes(language) && caption?.toLowerCase().includes('preview')) {
          return <LivePreview code={codeText} language={language} />;
        }
        return <Code {...props} />;
      },
      Collection, Equation, Pdf, Modal, Tweet,
      Header: NotionPageHeader,
      propertyLastEditedTimeValue: ({ block, pageHeader }, defaultFn: any) => (pageHeader && block?.last_edited_time) ? `Last updated ${formatDate(block?.last_edited_time, { month: 'long' })}` : defaultFn(),
      propertyDateValue: ({ data, schema, pageHeader }, defaultFn: any) => (pageHeader && schema?.name?.toLowerCase() === 'published' && data?.[0]?.[1]?.[0]?.[1]?.start_date) ? `Published ${formatDate(data?.[0]?.[1]?.[0]?.[1]?.start_date, { month: 'long' })}` : defaultFn(),
      propertyTextValue: ({ schema, pageHeader }, defaultFn: any) => (pageHeader && schema?.name?.toLowerCase() === 'author') ? <b>{defaultFn()}</b> : defaultFn(),
      PageLink: ({ children, href, as, ...rest }: any) => {
        const targetUrl = as !== undefined ? (as || '#') : (href || '#');
        return <Link href={targetUrl} {...rest}>{children}</Link>;
      },
    }), [site, draftView]);

  const isLiteMode = lite === 'true';
  if (router.isFallback) return null;
  if (error || !site || !recordMap) return <Page404 site={site} pageId={pageId} error={error} />;
  const block = recordMap.block[Object.keys(recordMap.block)[0]]?.value;
  if (!block) return <Page404 site={site} pageId={pageId} />;

  const isBlogPost = block?.type === 'page' && block?.parent_table === 'collection';
  const pageAside = <PageAside block={block} recordMap={recordMap} isBlogPost={isBlogPost} recentPosts={recentPosts} />;

  return (
    <>
      {isLiteMode && <BodyClassName className="notion-lite" />}
      <NotionRenderer
        className={cs(pageId === site.rootNotionPageId ? 'indexPage' : 'childPage')} 
        bodyClassName={cs(styles.notion, pageId === site.rootNotionPageId && 'index-page')} 
        darkMode={isDarkMode} components={components} recordMap={recordMap} 
        rootPageId={site.rootNotionPageId} rootDomain={site.domain} fullPage={!isLiteMode} 
        previewImages={!!recordMap.preview_images} showCollectionViewDropdown={true} 
        showTableOfContents={isBlogPost} minTableOfContentsItems={1} 
        mapPageUrl={mapPageUrl(site, recordMap, new URLSearchParams(lite ? { lite } : {}), draftView)} 
        mapImageUrl={mapImageUrl} searchNotion={config.isSearchEnabled ? searchNotion : undefined} pageAside={pageAside}
        pageFooter={config.enableComment && isBlogPost && <Comments pageId={block.id} recordMap={recordMap} />}
        footer={<Footer />} 
      />
    </>
  );
};