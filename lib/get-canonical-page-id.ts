import { ExtendedRecordMap } from 'notion-types'
import { parsePageId } from 'notion-utils'
import { inversePageUrlOverrides } from './config'

/**
 * https://namu.wiki/w/%EB%82%98%20%ED%98%BC%EC%9E%90%20%ED%8A%B9%EC%84%B1%EB%B9%A8%EB%A1%9C%20%EB%AC%B4%ED%95%9C%20%EC%84%B1%EC%9E%A5
 * 노션 라이브러리의 기본 슬러그(제목-ID) 생성 기능을 제거하고
 * 오직 고유 ID(UUID)만 반환하여 한글 슬러그로 인한 404 에러를 원천 차단합니다.
 */
export function getCanonicalPageId(
  pageId: string,
  recordMap: ExtendedRecordMap,
  { uuid = true }: { uuid?: boolean } = {}
): string | null {
  // 1. parsePageId는 입력된 ID에서 대시(-)를 제거하고 32자리 순수 ID만 추출합니다.
  const cleanPageId = parsePageId(pageId, { uuid: false })
  
  if (!cleanPageId) {
    return null
  }

  // 2. config.ts에 정의된 URL 오버라이드(예: index, blog 등 별칭)가 있다면 그것을 우선 사용합니다.
  const override = inversePageUrlOverrides[cleanPageId]
  if (override) {
    return override
  } else {
    // 3. [핵심 변경] 기존의 getCanonicalPageIdImpl 호출을 완전히 제거했습니다.
    // 더 이상 노션 페이지 제목을 읽어오지 않으며, 오직 깨끗한 ID만 주소로 반환합니다.
    return cleanPageId
  }
}