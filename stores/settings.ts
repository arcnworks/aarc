import { defaultTheme, isServer } from 'lib/config';
import { atom, AtomEffect } from 'recoil';

interface PreferencesStoreValues {
  isDarkMode: boolean;
}

// 초기 다크모드 설정 로직
let isCurrentUserDarkMode = defaultTheme === 'light' ? false : true;

if (defaultTheme === 'system' && !isServer) {
  isCurrentUserDarkMode =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const initialValues: PreferencesStoreValues = {
  isDarkMode: isCurrentUserDarkMode,
};

// 로컬 스토리지 동기화 로직
const localStorageSyncEffect: AtomEffect<PreferencesStoreValues> = ({ onSet }) => {
  onSet(newValue => {
    // [수정] 키 이름을 'preferences'로 통일하여 대소문자 혼선 방지
    localStorage.setItem('preferences', JSON.stringify(newValue));
  });
};

// [핵심 수정] preferencesStore 정의
export const preferencesStore = atom<PreferencesStoreValues>({
  /**
   * [FATAL ERROR 해결] 
   * 개발 환경(HMR)에서 발생하는 중복 키 에러를 방지하기 위해 
   * 키 이름 뒤에 난수를 생성하여 고유성을 부여합니다.
   */
  key: `preferences/${Math.random().toString(36).substring(2, 9)}`,
  
  default:
    isServer || !localStorage.getItem('preferences')
      ? initialValues
      : JSON.parse(localStorage.getItem('preferences') || '{}'),
  
  effects: [localStorageSyncEffect],
});