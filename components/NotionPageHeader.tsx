import * as React from 'react';
import cs from 'classnames';
import { IoSunnyOutline } from '@react-icons/all-files/io5/IoSunnyOutline';
import { IoMoonSharp } from '@react-icons/all-files/io5/IoMoonSharp';
import { Header, Breadcrumbs, Search, useNotionContext } from 'react-notion-x';
import * as types from 'notion-types';

import { useDarkMode } from 'lib/use-dark-mode';
import { navigationStyle, navigationLinks, isSearchEnabled } from 'lib/config';

import styles from './styles.module.css';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion'; // ✅ 애니메이션 라이브러리 추가


export const ToggleThemeButton = () => {
  const [hasMounted, setHasMounted] = React.useState(false);
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const onToggleTheme = React.useCallback(() => {
    toggleDarkMode();
  }, [toggleDarkMode]);

  return (
    <div
      className={cs('breadcrumb', 'button', !hasMounted && styles.hidden)}
      onClick={onToggleTheme}
    >
      {hasMounted && isDarkMode ? <IoMoonSharp /> : <IoSunnyOutline />}
    </div>
  );
};

export const NotionPageHeader: React.FC<{
  block: types.CollectionViewPageBlock | types.PageBlock;
}> = ({ block }) => {
  const { components, mapPageUrl } = useNotionContext();
  const { isDarkMode } = useDarkMode();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false); // ✅ 메뉴 상태 추가

  if (navigationStyle === 'default') {
    return <Header block={block} />;
  }

  return (
    <> {/* ✅ 1. 컴포넌트를 감싸는 빈 태그 추가 */}
      <header className="notion-header">
        <div className="notion-nav-header">
          {/* 로고 추가 */}
          <div className={styles['logo-container']}>
            <Link href="/" legacyBehavior>
              <a>
                <img
                  src={isDarkMode ? '/logo-w.png' : '/logo-b.png'}
                  alt="AaRC 로고"
                  style={{ width: '96px', height: 'auto' }}
                  className={styles.logo}
                />
              </a>
            </Link>
          </div>

          <Breadcrumbs block={block} />

          <div className="notion-nav-header-rhs breadcrumbs">
            {navigationLinks
              ?.map((link, index) => {
                if ((!link.pageId && !link.url) || link.menuPage) {
                  return null;
                }

                if (link.pageId) {
                  return (
                    <components.PageLink
                      href={mapPageUrl(link.pageId)}
                      key={index}
                      className={cs(styles.navLink, 'breadcrumb', 'button', 'notion-nav-header-wide')}
                    >
                      {link.title}
                    </components.PageLink>
                  );
                } else if (link.url) {
                  return (
                    <components.Link
                      href={link.url}
                      key={index}
                      className={cs(styles.navLink, 'breadcrumb', 'button', 'notion-nav-header-wide')}
                    >
                      {link.title}
                    </components.Link>
                  );
                }
              })
              .filter(Boolean)}

            <ToggleThemeButton />

            {isSearchEnabled && <Search block={block} title={null} />}

            {navigationLinks
              ?.map((link, index) => {
                if (!link.pageId && !link.url) {
                  return null;
                }

                if (link.menuPage == true) {
                  return (
                    <div
                      key={index}
                      onClick={() => setIsMobileMenuOpen(true)}
                      className={cs(
                        styles.navLink,
                        'breadcrumb',
                        'button',
                        'notion-nav-header-mobile',
                      )}
                    >
                      <svg
                        strokeWidth="0"
                        width="40px"
                        height="20px"
                        viewBox="0 0 25 25"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M0 0h24v24H0z" fill="none" />
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                      </svg>
                    </div>
                  );
                }
              })
              .filter(Boolean)}
          </div>
        </div>
      </header>

      {/* ✅ 2. 모바일 메뉴를 header 태그 '밖으로' 꺼냅니다. (잘림 현상 해결) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="arc-mobile-menu-overlay"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="arc-mobile-menu-header">
              <div className={styles['logo-container']}>
                <img
                  src={isDarkMode ? '/logo-w.png' : '/logo-b.png'}
                  alt="AaRC 로고"
                  style={{ width: '96px', height: 'auto' }}
                />
              </div>
              <button className="arc-close-btn" onClick={() => setIsMobileMenuOpen(false)}>✕</button>
            </div>
            
            <div className="arc-mobile-menu-content">
              {navigationLinks?.map((link, idx) => {
                // Category 버튼 자신은 목록에서 제외
                if (link.menuPage) return null; 
                
                // mapPageUrl이 실패할 경우를 대비한 안전망 추가
                const targetUrl = link.pageId ? (mapPageUrl(link.pageId) || `/${link.pageId}`) : link.url;
                if (!targetUrl) return null;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                  >
                    <Link href={targetUrl} legacyBehavior>
                      <a className="arc-mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>
                        {link.title}
                      </a>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </> 
  );
};
