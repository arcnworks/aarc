// packages/notion-utils/uuid-to-id.ts

export const uuidToId = (uuid: string) => {
  // 💡 [수정] uuid가 없거나 문자열이 아닐 경우를 대비한 방어 로직입니다.
  if (!uuid || typeof uuid !== 'string') {
    return ''
  }
  return uuid.replace(/-/g, '')
}