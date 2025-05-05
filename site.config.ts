import { siteConfig } from './lib/site-config';

export default siteConfig({
  // the site's root Notion page (required)
  rootNotionPageId: '15c693fb941780c19eb5f250d59f1367',

  // if you want to restrict pages to a single notion workspace (optional)
  // (this should be a Notion ID; see the docs for how to extract this)
  rootNotionSpaceId: 'null',

  // 사이트 기본 정보 (필수)
  name: '느낌의 건축,아크(AaRC)', // 사이트 이름
  domain: 'arcnworks.notion.site', // 사이트 도메인
  author: '©AaRC(Architecture and Research in Culture). All rights reserved.',// 작성자 이름
  // 오픈 그래프 메타데이터 (선택사항)
  // 웹페이지 공유 시 보여질 간단한 설명
  description: 'AaRC(아크)의 공식블로그',

  // social usernames (optional)
  instagram: 'arcnworks',
  // twitter: '#',
  //github: '#',
  // linkedin: '#',
  //newsletter: '#', // optional newsletter URL
  youtube: 'arcnworks', // optional youtube channel name or `channel/UCGbXXXXXXXXXXXXXXXXXXXXXX`

  // default notion icon and cover images for site-wide consistency (optional)
  // page-specific values will override these site-wide defaults
  defaultPageIcon:
    'https://www.notion.so/image/https%3A%2F%2Fs3-us-west-2.amazonaws.com%2Fsecure.notion-static.com%2F0d2daa37-61d0-45b6-b333-9a2bd0bdc3ee%2Fprofile_%25E1%2584%2580%25E1%2585%25A9%25E1%2584%2592%25E1%2585%25AA%25E1%2584%258C%25E1%2585%25B5%25E1%2586%25AF_circle.png?table=block&id=d1e89e9e-42eb-4ebf-9486-ae0374039efc&spaceId=2eb5336b-2edb-42d0-bc6c-95d72d4d1b74&width=250&userId=bef10e95-202b-4b6b-9626-7af866b6f9ba&cache=v2',
  defaultPageCover: null,
  defaultPageCoverPosition: 0.5,

  // whether or not to enable support for LQIP preview images (optional)
  isPreviewImageSupportEnabled: true,

  // whether or not redis is enabled for caching generated preview images (optional)
  // NOTE: if you enable redis, you need to set the `REDIS_HOST` and `REDIS_PASSWORD`
  // environment variables. see the readme for more info
  isRedisEnabled: false,

  pageUrlOverrides: {
    '/home': '15c693fb941780c19eb5f250d59f1367',
    '/about': '154693fb941780f3ad56c98248b17dda',
    '/works': '165693fb9417800c8baadf2ba5ea5139',
    '/blog': '165693fb941780fab52fee6442e580bd',
    '/contact': '154693fb9417807b9ae5db9b64489c9a',
    '/category': '155693fb94178076b2c5e73f7d3cd377',
  },

  // 네비게이션 스타일 설정 (기본 Notion 네비게이션 사용 여부)
  // 중요한 페이지로 연결되는 링크가 있는 커스텀 네비게이션을 사용할 수 있습니다.
  // `navigationLinks`를 사용하려면 `navigationStyle`을 'custom'으로 설정해야 합니다.
  navigationStyle: 'custom', // 네비게이션 스타일을 커스텀으로 설정
  navigationLinks: [
    {
      title: 'Home', // 네비게이션에 표시될 이름
      pageId: '15c693fb941780c19eb5f250d59f1367', // 연결될 Notion 페이지의 ID
    },
    {

      title: 'about',
      pageId: '154693fb941780f3ad56c98248b17dda',
    },
    {
      title: 'Works',
      pageId: '165693fb9417800c8baadf2ba5ea5139',
    },
    {
      title: 'blog',
      pageId: '165693fb941780fab52fee6442e580bd',
    },
    {
      title: 'contact',
      pageId: '154693fb9417807b9ae5db9b64489c9a',
    },
    {
      title: 'category',
      pageId: '155693fb94178076b2c5e73f7d3cd377',
      menuPage: true,
    },
  ],
  // -------- custom configs  -------------

  // date-fns format string
  dateformat: 'yyyy년 MM월 dd일',

  // post page - hidden properties
  hiddenPostProperties: ['상태', '생성일', '' ],

  // contentPosition (table of contents) text align
  contentPositionTextAlign: 'left',

  // default theme color
  defaultTheme: 'light',

  // enable comment
  enableComment: true,
});
