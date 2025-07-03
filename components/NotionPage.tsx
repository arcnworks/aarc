import dynamic from 'next/dynamic'; // Next.js의 동적 로딩 기능을 사용하여 컴포넌트를 가져옵니다.

import Link from 'next/link'; // Next.js의 링크 컴포넌트로, 클라이언트 측 경로 전환을 처리합니다.
import { useRouter } from 'next/router'; // 라우팅 정보를 가져오는 Next.js 훅입니다.
import * as React from 'react'; // React 라이브러리를 가져옵니다.
import BodyClassName from 'react-body-classname'; // body 태그에 클래스를 동적으로 추가하는 컴포넌트입니다.
// core notion renderer
import { NotionRenderer } from 'react-notion-x'; // Notion 페이지를 렌더링하는 주요 컴포넌트입니다.
import TweetEmbed from 'react-tweet-embed'; // 트윗을 임베드하는 컴포넌트입니다.
import { useSearchParam } from 'react-use'; // URL의 검색 매개변수를 읽는 데 사용됩니다.

import cs from 'classnames'; // 조건부 클래스 이름을 처리하는 유틸리티입니다.
import * as config from 'lib/config'; // 프로젝트 설정 및 구성 정보를 가져옵니다.
import { mapImageUrl } from 'lib/map-image-url'; // 이미지 URL을 변환하는 유틸리티 함수입니다.
import { getCanonicalPageUrl, mapPageUrl } from 'lib/map-page-url'; // 페이지 URL을 생성하거나 변환합니다.
import { searchNotion } from 'lib/search-notion'; // Notion 데이터를 검색하는 함수입니다.
import * as types from 'lib/types'; // TypeScript 타입 정의를 가져옵니다.
import { useDarkMode } from 'lib/use-dark-mode'; // 다크모드 상태를 관리하는 훅입니다.
import { PageBlock } from 'notion-types'; // Notion 블록의 타입 정의입니다.
// utils
import { formatDate, getBlockTitle, getPageProperty } from 'notion-utils'; // 날짜 형식화, 블록 제목 가져오기 등 유틸리티 함수입니다.

import { loadPrismComponentsWithRetry } from '~/lib/load-prism-components'; // PrismJS 구문 강조 컴포넌트를 로드하는 함수입니다.

import Comments from './Comments'; // 댓글 컴포넌트를 가져옵니다.
// components
import { Loading } from './Loading'; // 로딩 상태를 나타내는 컴포넌트입니다.
import { Footer } from './Footer'; //푸터를 없앨 시 //로 비활성화 합니다.
import { NotionPageHeader, ToggleThemeButton } from './NotionPageHeader'; // 페이지 헤더와 테마 전환 버튼 컴포넌트를 가져옵니다.
import { Page404 } from './Page404'; // 404 페이지 컴포넌트를 가져옵니다.
import { PageAside } from './PageAside'; // 페이지 사이드바 컴포넌트를 가져옵니다.
import { PageHead } from './PageHead'; // 페이지의 메타 정보를 설정하는 컴포넌트입니다.
import styles from './styles.module.css'; // 스타일 모듈을 가져옵니다.

// -----------------------------------------------------------------------------
// dynamic imports for optional components
// -----------------------------------------------------------------------------

const Code = dynamic(() =>
  import('react-notion-x/third-party/code').then(async m => {
    // add / remove any prism syntaxes here
    // PrismJS의 구문 강조 기능을 동적으로 로드합니다.
    await loadPrismComponentsWithRetry([
      () => import('prismjs/components/prism-markup-templating.js'), // HTML 템플릿 구문 강조
      () => import('prismjs/components/prism-markup.js'), // HTML 마크업 구문 강조
      () => import('prismjs/components/prism-bash.js'), // Bash 스크립트 구문 강조
      () => import('prismjs/components/prism-c.js'), // C 언어 구문 강조
      () => import('prismjs/components/prism-cpp.js'), // C++ 언어 구문 강조
      () => import('prismjs/components/prism-csharp.js'), // C# 언어 구문 강조
      () => import('prismjs/components/prism-docker.js'), // Dockerfile 구문 강조
      () => import('prismjs/components/prism-java.js'), // Java 언어 구문 강조
      () => import('prismjs/components/prism-js-templates.js'), // JavaScript 템플릿 구문 강조
      () => import('prismjs/components/prism-coffeescript.js'), // CoffeeScript 구문 강조
      () => import('prismjs/components/prism-diff.js'), // Diff 파일 구문 강조
      () => import('prismjs/components/prism-git.js'), // Git 구문 강조
      () => import('prismjs/components/prism-go.js'), // Go 언어 구문 강조
      () => import('prismjs/components/prism-graphql.js'), // GraphQL 구문 강조
      () => import('prismjs/components/prism-handlebars.js'), // Handlebars 템플릿 구문 강조
      () => import('prismjs/components/prism-less.js'), // LESS CSS 구문 강조
      () => import('prismjs/components/prism-makefile.js'), // Makefile 구문 강조
      () => import('prismjs/components/prism-markdown.js'), // Markdown 구문 강조
      () => import('prismjs/components/prism-objectivec.js'), // Objective-C 구문 강조
      () => import('prismjs/components/prism-ocaml.js'), // OCaml 언어 구문 강조
      () => import('prismjs/components/prism-python.js'), // Python 언어 구문 강조
      () => import('prismjs/components/prism-reason.js'), // Reason 언어 구문 강조
      () => import('prismjs/components/prism-rust.js'), // Rust 언어 구문 강조
      () => import('prismjs/components/prism-sass.js'), // SASS 구문 강조
      () => import('prismjs/components/prism-scss.js'), // SCSS 구문 강조
      () => import('prismjs/components/prism-solidity.js'), // Solidity 언어 구문 강조
      () => import('prismjs/components/prism-sql.js'), // SQL 구문 강조
      () => import('prismjs/components/prism-stylus.js'), // Stylus 구문 강조
      () => import('prismjs/components/prism-swift.js'), // Swift 언어 구문 강조
      () => import('prismjs/components/prism-wasm.js'), // WebAssembly 구문 강조
      () => import('prismjs/components/prism-yaml.js'), // YAML 구문 강조
    ]);

    return m.Code; // 구문 강조 기능이 포함된 코드 컴포넌트를 반환합니다.
  }),
);

const Collection = dynamic(
  () => import('react-notion-x/third-party/collection').then(m => m.Collection), // Notion의 컬렉션 데이터를 렌더링하는 컴포넌트를 동적으로 가져옵니다.
);
const Equation = dynamic(() => import('react-notion-x/third-party/equation').then(m => m.Equation)); // 수식 렌더링을 위한 컴포넌트를 동적으로 가져옵니다.
const Pdf = dynamic(() => import('react-notion-x/third-party/pdf').then(m => m.Pdf), {
  ssr: false, // 서버 사이드 렌더링 비활성화
});
const Modal = dynamic(
  () =>
    import('react-notion-x/third-party/modal').then(m => {
      m.Modal.setAppElement('.notion-viewport'); // 모달의 루트 요소를 설정합니다.
      return m.Modal;
    }),
  {
    ssr: false, // 서버 사이드 렌더링 비활성화
  },
);

const Tweet = ({ id }: { id: string }) => {
  return <TweetEmbed tweetId={id} />; // 트윗 ID를 기반으로 트윗을 임베드합니다.
};

const propertyLastEditedTimeValue = ({ block, pageHeader }, defaultFn: () => React.ReactNode) => {
  if (pageHeader && block?.last_edited_time) {
    return `Last updated ${formatDate(block?.last_edited_time, {
      month: 'long',
    })}`; // 블록의 마지막 수정 시간을 포맷팅하여 반환합니다.
  }

  return defaultFn(); // 기본 값을 반환합니다.
};

const propertyDateValue = ({ data, schema, pageHeader }, defaultFn: () => React.ReactNode) => {
  if (pageHeader && schema?.name?.toLowerCase() === 'published') {
    const publishDate = data?.[0]?.[1]?.[0]?.[1]?.start_date;

    if (publishDate) {
      return `Published ${formatDate(publishDate, {
        month: 'long',
      })}`; // 게시 날짜를 포맷팅하여 반환합니다.
    }
  }

  return defaultFn(); // 기본 값을 반환합니다.
};

const propertyTextValue = ({ schema, pageHeader }, defaultFn: () => React.ReactNode) => {
  if (pageHeader && schema?.name?.toLowerCase() === 'author') {
    return <b>{defaultFn()}</b>; // 작성자 이름을 강조합니다.
  }

  return defaultFn(); // 기본 값을 반환합니다.
};

export const NotionPage: React.FC<types.PageProps> = ({
  site,
  recordMap,
  error,
  pageId,
  draftView,
}) => {
  const router = useRouter(); 
  const lite = useSearchParam('lite'); 

  const components = React.useMemo(
    () => ({
      // nextImage: Image, ← 제거
      nextLink: Link,
      Code,
      Collection,
      Equation,
      Pdf,
      Modal,
      Tweet,
      Header: NotionPageHeader,
      propertyLastEditedTimeValue,
      propertyTextValue,
      propertyDateValue,
      PageLink: ({ children, href, ...rest }) => (
        <Link href={href} {...rest}>
          {children}
        </Link>
      ),
    }),
    [],
  );

  // lite mode is for oembed
  const isLiteMode = lite === 'true';

  const { isDarkMode } = useDarkMode();

  const siteMapPageUrl = React.useMemo(() => {
    const params: any = {};
    if (lite) params.lite = lite;

    const searchParams = new URLSearchParams(params);
    return mapPageUrl(site, recordMap, searchParams, draftView);
  }, [site, recordMap, lite, draftView]);

  const keys = Object.keys(recordMap?.block || {});
  const block = recordMap?.block?.[keys[0]]?.value;

  // const isRootPage =
  //   parsePageId(block?.id) === parsePageId(site?.rootNotionPageId)
  const isBlogPost = block?.type === 'page' && block?.parent_table === 'collection';

  const showTableOfContents = !!isBlogPost;
  const minTableOfContentsItems = 1;

  const pageAside = React.useMemo(
    () => <PageAside block={block} recordMap={recordMap} isBlogPost={isBlogPost} />,
    [block, recordMap, isBlogPost],
  );

  // const footer = React.useMemo(() => <Footer />, []);

  if (router.isFallback) {
    return null;
  }

  if (error || !site || !block) {
    return <Page404 site={site} pageId={pageId} error={error} />;
  }

  const title = getBlockTitle(block, recordMap) || site.name;

  if (!config.isServer) {
    // add important objects to the window global for easy debugging
    const g = window as any;
    g.pageId = pageId;
    g.recordMap = recordMap;
    g.block = block;
  }

  const canonicalPageUrl = !config.isDev && getCanonicalPageUrl(site, recordMap)(pageId);

  const socialImage = mapImageUrl(
    getPageProperty<string>('Social Image', block, recordMap) ||
      (block as PageBlock).format?.page_cover ||
      config.defaultPageCover,
    block,
  );

  const socialDescription = getPageProperty<string>('설명', block, recordMap) || config.description; // 소셜 미디어에 사용할 설명을 생성합니다.

  const isIndexPage = pageId === site.rootNotionPageId; // 현재 페이지가 인덱스 페이지인지 확인합니다.

  const hasCollectionView = Object.keys(recordMap.collection_query).length; // 컬렉션 뷰가 있는지 확인합니다.

  return (
    <>
      <PageHead
        pageId={pageId}
        site={site}
        title={title}
        description={socialDescription}
        image={socialImage}
      />

      {isLiteMode && <BodyClassName className="notion-lite" />}
      <NotionRenderer
        className={cs(isIndexPage ? 'indexPage' : 'childPage', { hasCollectionView })} // 페이지의 클래스 이름을 설정합니다.
        bodyClassName={cs(styles.notion, isIndexPage && 'index-page')} // Notion 스타일 클래스를 설정합니다.
        darkMode={isDarkMode} // 다크모드 여부를 설정합니다.
        components={components} // 렌더링에 필요한 컴포넌트를 전달합니다.
        recordMap={recordMap} // Notion의 레코드 데이터를 전달합니다.
        rootPageId={site.rootNotionPageId} // 루트 페이지 ID를 설정합니다.
        rootDomain={site.domain} // 사이트 도메인을 설정합니다.
        fullPage={!isLiteMode} // 전체 페이지 여부를 설정합니다.
        previewImages={!!recordMap.preview_images} // 미리보기 이미지 사용 여부를 설정합니다.
        showCollectionViewDropdown={true} // 컬렉션 뷰 드롭다운 설정
        showTableOfContents={showTableOfContents} // 목차 표시 여부를 설정합니다.
        minTableOfContentsItems={minTableOfContentsItems} // 최소 목차 항목 수를 설정합니다.
        //defaultPageIcon={config.defaultPageIcon} // 기본 페이지 아이콘을 설정합니다.
        //defaultPageCover={config.defaultPageCover} // 기본 페이지 커버를 설정합니다.
        //defaultPageCoverPosition={config.defaultPageCoverPosition} // 기본 페이지 커버 위치를 설정합니다.
        mapPageUrl={siteMapPageUrl} // 페이지 URL 매핑을 설정합니다.
        mapImageUrl={mapImageUrl} // 이미지 URL 매핑을 설정합니다.
        searchNotion={config.isSearchEnabled ? searchNotion :undefined} // 검색 기능을 설정합니다.
        pageAside={pageAside} // 사이드바 컴포넌트를 설정합니다.
        pageFooter={
          config.enableComment ? (
            !isBlogPost ? null : (
              <Comments pageId={pageId} recordMap={recordMap} /> // 댓글 컴포넌트를 렌더링합니다.
            )
          ) : null
        }
        footer={<Footer />} // footer={null} 푸터를 비활성화합니다.
      />
    </>
  );
};
