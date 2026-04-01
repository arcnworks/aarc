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
const Tweet = ({ id }: { id: string }) => <TweetEmbed tweetId={id} />;

export const NotionPage: React.FC<types.PageProps & { recentPosts?: any[] }> = ({ site, recordMap, error, pageId, draftView, recentPosts }) => {
  const router = useRouter(); 
  const lite = useSearchParam('lite'); 
  const { isDarkMode } = useDarkMode();

  /**
   * [기능] 이미지 하이퍼링크 주입 및 현재 창 이동 설정
   */
  React.useEffect(() => {
    if (!recordMap || !recordMap.block) return;

    const idMap: Record<string, string> = {};
    Object.keys(recordMap.block).forEach((id) => {
      idMap[id.replace(/-/g, '')] = id;
    });

    const wrappers = document.querySelectorAll('.notion-asset-wrapper-image');
    
    wrappers.forEach((wrapper: any) => {
      if (wrapper.querySelector('.arc-link-applied')) return;

      const blockClass = Array.from(wrapper.classList).find((c: any) => c.startsWith('notion-block-')) as string;
      if (!blockClass) return;

      const shortId = blockClass.replace('notion-block-', '');
      const originalId = idMap[shortId]; 
      if (!originalId) return;

      const block = recordMap.block[originalId]?.value;
      const link = block?.format?.image_hyperlink || block?.format?.block_link;

      if (link) {
        const img = wrapper.querySelector('img');
        if (!img || !img.parentElement) return;

        const a = document.createElement('a');
        a.href = link;
        a.target = '_self'; // 현재 창 이동
        a.className = 'arc-link-applied';
        a.style.display = 'block';
        a.style.width = '100%';
        a.style.height = '100%';
        
        a.onclick = (e) => e.stopPropagation();
        
        img.style.cursor = 'pointer';
        img.parentElement.insertBefore(a, img);
        a.appendChild(img);
      }
    });
  }, [recordMap, pageId]);

  const components = React.useMemo(() => ({
      nextImage: Image, 
      nextLink: ({ href, as, ...rest }: any) => {
        const targetUrl = as !== undefined ? (as || '#') : (href || '#');
        return <Link href={targetUrl} {...rest} />;
      },
      Code: (props: any) => <Code {...props} />,
      Collection, Equation, Pdf, Tweet,
      Header: NotionPageHeader,
      propertyDateValue: ({ data, schema, pageHeader }: any, defaultFn: any) => {
        if (schema?.name?.includes('연도') && data?.[0]?.[1]?.[0]?.[1]?.start_date) {
            return data?.[0]?.[1]?.[0]?.[1]?.start_date.split('-')[0];
        }
        return defaultFn();
      },
      propertyLastEditedTimeValue: ({ block, pageHeader }, defaultFn: any) => defaultFn(),
      propertyTextValue: ({ schema, pageHeader }, defaultFn: any) => defaultFn(),
      PageLink: ({ children, href, as, ...rest }: any) => <Link href={href || '#'}>{children}</Link>,
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
      <style dangerouslySetInnerHTML={{ __html: `
        /* 헤더 메뉴 간격 교정 */
        .notion-nav-header-rhs.breadcrumbs {
          display: flex !important;
          align-items: center !important;
          gap: 1.2rem !important;
        }

        /* 이미지 줌 방지 */
        .notion-image-zoom-trigger {
          cursor: auto !important;
        }
      `}} />
      
      {isLiteMode && <BodyClassName className="notion-lite" />}
      <NotionRenderer
        className={cs(pageId === site.rootNotionPageId ? 'indexPage' : 'childPage')} 
        bodyClassName={cs(styles.notion, pageId === site.rootNotionPageId && 'index-page')} 
        darkMode={isDarkMode} components={components} recordMap={recordMap} 
        rootPageId={site.rootNotionPageId} rootDomain={site.domain} fullPage={!isLiteMode} 
        previewImages={!!recordMap.preview_images} showCollectionViewDropdown={true} 
        showTableOfContents={isBlogPost} minTableOfContentsItems={1} 
        isImageZoomable={false} 
        mapPageUrl={mapPageUrl(site, recordMap, new URLSearchParams(lite ? { lite } : {}), draftView)} 
        mapImageUrl={mapImageUrl} searchNotion={config.isSearchEnabled ? searchNotion : undefined} pageAside={pageAside}
        pageFooter={config.enableComment && isBlogPost && <Comments pageId={block.id} recordMap={recordMap} />}
        footer={<Footer />} 
      />
    </>
  );
};