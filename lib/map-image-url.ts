import { Block } from 'notion-types'
import { defaultMapImageUrl } from 'react-notion-x'

import { defaultPageIcon, defaultPageCover } from './config'

export const mapImageUrl = (url: string, block: Block) => {
  if (!url) return null;

  // 기본 커버/아이콘은 그대로
  if (url === defaultPageCover || url === defaultPageIcon) {
    return url;
  }

  // 이미 Notion 퍼블릭 이미지 CDN이면 그대로 사용
  if (url.startsWith('https://www.notion.so/image/')) {
    return url;
  }

  // signed URL이거나 외부 링크일 경우 CDN 프록시로 우회
  return `https://www.notion.so/image/${encodeURIComponent(url)}?table=block&id=${block?.id}&cache=v2`;
};
