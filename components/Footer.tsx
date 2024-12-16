import * as React from 'react'; // React 라이브러리를 가져옵니다.
import { FaTwitter } from '@react-icons/all-files/fa/FaTwitter'; // 트위터 아이콘을 가져옵니다.
import { FaZhihu } from '@react-icons/all-files/fa/FaZhihu'; // Zhihu 아이콘을 가져옵니다.
import { FaGithub } from '@react-icons/all-files/fa/FaGithub'; // GitHub 아이콘을 가져옵니다.
import { FaLinkedin } from '@react-icons/all-files/fa/FaLinkedin'; // LinkedIn 아이콘을 가져옵니다.
import { FaEnvelopeOpenText } from '@react-icons/all-files/fa/FaEnvelopeOpenText'; // 이메일 아이콘을 가져옵니다.
import { FaInstagram } from '@react-icons/all-files/fa/FaInstagram'; // 인스타그램 아이콘을 가져옵니다.
import { FaYoutube } from '@react-icons/all-files/fa/FaYoutube'; // 유튜브 아이콘을 가져옵니다.
import { IoSunnyOutline } from '@react-icons/all-files/io5/IoSunnyOutline'; // 밝은 모드 아이콘을 가져옵니다.
import { IoMoonSharp } from '@react-icons/all-files/io5/IoMoonSharp'; // 어두운 모드 아이콘을 가져옵니다.

import { useDarkMode } from 'lib/use-dark-mode'; // 다크모드 상태를 관리하는 사용자 정의 훅입니다.
import * as config from 'lib/config'; // 프로젝트 설정 파일을 가져옵니다.

import styles from './styles.module.css'; // 스타일 모듈을 가져옵니다.

// TODO: merge the data and icons from PageSocial with the social links in Footer
// 소셜 링크와 관련된 데이터를 통합할 필요가 있음

export const FooterImpl: React.FC = () => {
  const [hasMounted, setHasMounted] = React.useState(false); // 클라이언트 마운트 상태를 추적합니다.
  const { isDarkMode, toggleDarkMode } = useDarkMode(); // 다크모드 상태와 토글 함수입니다.

  const onToggleDarkMode = React.useCallback(
    e => {
      e.preventDefault(); // 기본 동작 방지
      toggleDarkMode(); // 다크모드 상태를 토글합니다.
    },
    [toggleDarkMode],
  );

  React.useEffect(() => {
    setHasMounted(true); // 컴포넌트가 클라이언트에서 마운트된 상태를 설정합니다.
  }, []);

  return (
    <footer className={styles.footer}>
      {/* 푸터 컨테이너 */}
      <div className={styles.copyright}>
        Copyright 2022 @ {config.author} {/* 저작권 정보 */}
      </div>
      {/*<div className={styles.settings}>
        {hasMounted && (
          <a
            className={styles.toggleDarkMode}
            href="#"
            role="button"
            onClick={onToggleDarkMode}
            title="Toggle dark mode"
          >
            {isDarkMode ? <IoMoonSharp /> : <IoSunnyOutline />}
            
          </a>
        )}
      </div> */}{' '}
      {/* 현재 다크모드 상태에 따라 적합한 아이콘을 표시합니다. */}
      <div className={styles.social}>
        {/* 소셜 미디어 링크 */}
        {config.twitter && (
          <a
            className={styles.twitter}
            href={`https://twitter.com/${config.twitter}`}
            title={`Twitter @${config.twitter}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaTwitter />
          </a>
        )}
        {config.zhihu && (
          <a
            className={styles.zhihu}
            href={`https://zhihu.com/people/${config.zhihu}`}
            title={`Zhihu @${config.zhihu}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaZhihu />
          </a>
        )}
        {config.github && (
          <a
            className={styles.github}
            href={`https://github.com/${config.github}`}
            title={`GitHub @${config.github}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaGithub />
          </a>
        )}
        {config.linkedin && (
          <a
            className={styles.linkedin}
            href={`https://www.linkedin.com/in/${config.linkedin}`}
            title={`LinkedIn ${config.author}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaLinkedin />
          </a>
        )}
        {config.newsletter && (
          <a
            className={styles.newsletter}
            href={`${config.newsletter}`}
            title={`Newsletter ${config.author}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaEnvelopeOpenText />
          </a>
        )}
        {config.instagram && (
          <a
            className={styles.instagram}
            href={`https://www.instagram.com/${config.instagram}`}
            title={`Instagram ${config.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaInstagram />
          </a>
        )}
        {config.youtube && (
          <a
            className={styles.youtube}
            href={`https://www.youtube.com/${config.youtube}`}
            title={`YouTube ${config.author}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaYoutube />
          </a>
        )}
      </div>
    </footer>
  );
};

export const Footer = React.memo(FooterImpl); // Footer 컴포넌트를 React.memo로 감싸 성능 최적화를 합니다.
