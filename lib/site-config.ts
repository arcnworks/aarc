import * as types from './types';

export interface SiteConfig {
  rootNotionPageId: string;
  rootNotionSpaceId?: string;

  name: string;
  domain: string;
  author: string;
  description?: string;
  language?: string;

  twitter?: string;
  github?: string;
  linkedin?: string;
  newsletter?: string;
  youtube?: string;
  instagram?: string;
  zhihu?: string;

  defaultPageIcon?: string | null;
  defaultPageCover?: string | null;
  defaultPageCoverPosition?: number | null;

  isPreviewImageSupportEnabled?: boolean;
  isTweetEmbedSupportEnabled?: boolean;
  isRedisEnabled?: boolean;
  isSearchEnabled?: boolean;

  includeNotionIdInUrls?: boolean;
  pageUrlOverrides?: types.PageUrlOverridesMap;
  pageUrlAdditions?: types.PageUrlOverridesMap;

  navigationStyle?: types.NavigationStyle;
  navigationLinks?: Array<NavigationLink>;

  // custom configs 
  dateformat: string;
  hiddenPostProperties: string[];
  defaultTheme: 'light' | 'dark' | 'system';
  enableComment: boolean;
  contentPositionTextAlign: 'left' | 'right';
}

export interface NavigationLink {
  title: string;
  pageId?: string;
  url?: string;
  menuPage?: boolean;
}

export const siteConfig = (config: SiteConfig): SiteConfig => {
  return config;
};
