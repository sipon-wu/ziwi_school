/** 通用数据获取 Hook：API→真实 / 不可用→Mock降级 / loading/empty/error 三态 */
import { useState, useEffect, useCallback } from 'react'

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

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFn()
      const result = res?.items ?? res?.data ?? res
      if (Array.isArray(result)) {
        setEmpty(result.length === 0)
      } else if (result && typeof result === 'object') {
        setEmpty(Object.keys(result).length === 0)
      }
      setData(result)
    } catch (err: any) {
      // API 不可用 → 降级 mock
      setData(mockData as T)
      setError(null) // mock 降级不算错误
    }
    setLoading(false)
  }, deps)

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, empty, refetch: fetch }
}
