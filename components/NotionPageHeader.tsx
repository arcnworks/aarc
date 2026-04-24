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
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';

/* ---------------------------------------------------------
   1. 테마 토글 버튼 컴포넌트
   --------------------------------------------------------- */
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
    <div className={cs('breadcrumb', 'button', !hasMounted && styles.hidden)} onClick={onToggleTheme}>
      {hasMounted && isDarkMode ? <IoMoonSharp /> : <IoSunnyOutline />}
    </div>
  );
};

/* ---------------------------------------------------------
   2. 메인 네비게이션 헤더 컴포넌트
   --------------------------------------------------------- */
export const NotionPageHeader: React.FC<{ block: types.CollectionViewPageBlock | types.PageBlock; }> = ({ block }) => {
  const { components, mapPageUrl } = useNotionContext();
  const { isDarkMode } = useDarkMode();
  
  // 모바일 메뉴 및 언어 선택 메뉴 상태 관리
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = React.useState(false);

  const languages = [
    { code: 'ko', label: '한국어 (원본)' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'zh-CN', label: '中文(简体)' },
    { code: 'es', label: 'Español' },
    { code: 'ru', label: 'Русский' }
  ];

  // ✅ 지구본 버튼 클릭 시 자체 메뉴 토글
  const handleGlobeClick = () => {
    setIsLangMenuOpen(!isLangMenuOpen);
  };

  // ✅ 선택된 언어로 구글 엔진 강제 조작
  const changeLanguage = (langCode: string) => {
    // 🚨 [원천 해결] 원본 언어(한국어)로 돌아갈 때는 쿠키를 삭제하고 화면을 완전히 리셋합니다.
    if (langCode === 'ko') {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=${window.location.hostname}; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${window.location.hostname}; path=/;`;
      window.location.reload();
      return;
    }

    // 외국어 선택 시 구글 엔진 조작
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (combo) {
      combo.value = langCode;
      combo.dispatchEvent(new Event('change'));
      setIsLangMenuOpen(false);
    } else {
      alert("번역 엔진을 불러오고 있습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  if (navigationStyle === 'default') {
    return <Header block={block} />;
  }

  return (
    <>
      <header className="notion-header">
        <div className="notion-nav-header">
          {/* 로고 영역 */}
          <div className={styles['logo-container']}>
            <Link href="/" legacyBehavior>
              <a><img src={isDarkMode ? '/logo-w.png' : '/logo-b.png'} alt="AaRC 로고" style={{ width: '96px', height: 'auto' }} className={styles.logo} /></a>
            </Link>
          </div>

          <Breadcrumbs block={block} />

          <div className="notion-nav-header-rhs breadcrumbs">
            {/* 1. 기본 네비게이션 링크 */}
            {navigationLinks?.map((link, index) => {
              if ((!link.pageId && !link.url) || link.menuPage) return null;
              const targetUrl = link.pageId ? mapPageUrl(link.pageId) : link.url;
              return (
                <components.PageLink href={targetUrl} key={index} className={cs(styles.navLink, 'breadcrumb', 'button', 'notion-nav-header-wide')}>
                  {link.title}
                </components.PageLink>
              );
            }).filter(Boolean)}

            {/* 2. ✅ 다국어 지구본 버튼 (블랙 채우기 간섭 완벽 차단 및 스트로크 조절) */}
            <div 
              className={cs('breadcrumb', 'button', 'arc-translate-wrapper')} 
              onClick={handleGlobeClick}
            >
              <div className="arc-translate-btn" title="Language / 번역">
                <svg 
                  viewBox="0 0 512 512" 
                  height="1em"
                  width="1em"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    fill="none" 
                    stroke="currentColor"
                    strokeLinecap="round" 
                    strokeMiterlimit="10" 
                    strokeWidth="24" 
                    d="M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208 208-93.13 208-208S370.87 48 256 48z"
                  />
                  <path 
                    fill="none" 
                    stroke="currentColor"
                    strokeLinecap="round" 
                    strokeMiterlimit="10" 
                    strokeWidth="16" 
                    d="M256 48c-58.07 0-112.67 93.13-112.67 208S197.93 464 256 464s112.67-93.13 112.67-208S314.07 48 256 48z"
                  />
                  <path 
                    fill="none" 
                    stroke="currentColor"
                    strokeLinecap="round" 
                    strokeMiterlimit="10" 
                    strokeWidth="16" 
                    d="M48 256h416M125 152h262M125 360h262"
                  />
                </svg>
              </div>
            </div>

            {/* 3. 테마 토글 및 검색 버튼 */}
            <ToggleThemeButton />
            {isSearchEnabled && <Search block={block} title={null} />}

            {/* 4. 모바일 햄버거 메뉴 버튼 */}
            {navigationLinks?.map((link, index) => {
              if (link.menuPage === true) {
                return (
                  <div key={index} onClick={() => setIsMobileMenuOpen(true)} className={cs(styles.navLink, 'breadcrumb', 'button', 'notion-nav-header-mobile')}>
                    <svg strokeWidth="0" width="40px" height="20px" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 0h24v24H0z" fill="none" /><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                  </div>
                );
              }
              return null;
            }).filter(Boolean)}
          </div>
        </div>
      </header>
      
      {/* ✅ 다국어 선택 드롭다운 UI */}
      <AnimatePresence>
        {isLangMenuOpen && (
          <motion.div 
            className="arc-lang-dropdown"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
          >
            {languages.map(lang => (
              <div key={lang.code} className="arc-lang-item" onClick={() => changeLanguage(lang.code)}>
                {lang.label}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ 모바일 풀스크린 오버레이 메뉴 */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div className="arc-mobile-menu-overlay" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, ease: "easeOut" }}>
            
            <div className="arc-mobile-menu-header">
              <div className={styles['logo-container']}>
                <img src={isDarkMode ? '/logo-w.png' : '/logo-b.png'} alt="AaRC 로고" style={{ width: '96px', height: 'auto' }} />
              </div>
              <button className="arc-close-btn" onClick={() => setIsMobileMenuOpen(false)}>✕</button>
            </div>
            
            <div className="arc-mobile-menu-content">
              {navigationLinks?.map((link, idx) => {
                if (link.menuPage) return null; 
                const targetUrl = link.pageId ? (mapPageUrl(link.pageId) || `/${link.pageId}`) : link.url;
                if (!targetUrl) return null;
                
                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + idx * 0.05 }}>
                    <Link href={targetUrl} legacyBehavior>
                      <a className="arc-mobile-menu-link" onClick={() => setIsMobileMenuOpen(false)}>{link.title}</a>
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