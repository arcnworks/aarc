import { NotionAPI } from 'notion-client'

export const notion = new NotionAPI({
  apiBaseUrl: process.env.NOTION_API_BASE_URL,
  // CUSTOM: 비공개(private) 페이지도 불러올 수 있도록 인증 토큰을 사용합니다. (선택사항)
  authToken: process.env.NOTION_TOKEN_V2
})
