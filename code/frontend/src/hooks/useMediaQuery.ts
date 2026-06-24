import { useState, useEffect } from 'react'

/** 响应式断点检测 Hook，支持服务端渲染 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

/** 是否为移动端（<1024px，即 lg 断点以下） */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)')
}

/** 是否为桌面端（>=1024px，即 lg 断点） */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)')
}
