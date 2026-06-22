/** 通用数据获取 Hook：API→真实 / 不可用→Mock降级 / loading/empty/error 三态 + retry */
import { useState, useEffect, useCallback, useRef } from 'react'

export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  empty: boolean
  refetch: () => void
}

export function useApi<T>(apiFn: () => Promise<any>, mockData: T, deps: any[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)
  const mountedRef = useRef(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFn()
      if (!mountedRef.current) return
      const result = res?.items ?? res?.data ?? res
      if (Array.isArray(result)) {
        setEmpty(result.length === 0)
      } else if (result && typeof result === 'object') {
        setEmpty(Object.keys(result).length === 0)
      }
      setData(result)
    } catch (err: any) {
      if (!mountedRef.current) return
      // P2: API 失败时降级 mock 但仍记录错误信息供 UI 展示
      const errMsg = err?.message || '网络请求失败，已切换到离线模式'
      setData(mockData as T)
      setError(errMsg)
    }
    if (mountedRef.current) setLoading(false)
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    fetch()
    return () => { mountedRef.current = false }
  }, [fetch])

  return { data, loading, error, empty, refetch: fetch }
}

/** P2: 简单分页 Hook */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const paginated = items.slice((page - 1) * pageSize, page * pageSize)
  const goTo = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)))
  return { page, totalPages, paginated, goTo, setPage }
}
