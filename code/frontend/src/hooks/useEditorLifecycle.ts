import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * P0-6 生命周期状态机（前端 UI 态，不新增后端字段）。
 * 只管交互与状态，落库由各页通过 onAutoSave/onSaveDraft/onPublish 回调注入现有 api。
 *
 * 自动保存策略 = 混合 C：内容停手 autoSaveDelay 毫秒 debounce 才存 + 失焦/离开页面强制 flush。
 * status: unsaved -> autosaving -> draft -> published
 */
export type EditorStatus = 'unsaved' | 'autosaving' | 'draft' | 'published'

interface Options {
  /** debounce 毫秒，默认 8000 */
  autoSaveDelay?: number
  /** 自动保存回调（落库），不传则关闭自动保存 */
  onAutoSave?: () => Promise<unknown> | void
  /** 显式存草稿回调 */
  onSaveDraft?: () => Promise<unknown> | void
  /** 发布回调 */
  onPublish?: () => Promise<unknown> | void
  /** 失焦/离开时强制 flush 的回调，默认复用 onAutoSave */
  onFlush?: () => Promise<void> | void
}

export function useEditorLifecycle(opts: Options = {}) {
  const { autoSaveDelay = 8000, onAutoSave, onSaveDraft, onPublish, onFlush } = opts
  const [status, setStatus] = useState<EditorStatus>('unsaved')
  const [dirty, setDirty] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (!onAutoSave) return
    setSaving(true); setStatus('autosaving')
    try {
      await onAutoSave()
      setStatus('draft'); setDirty(false); setLastSavedAt(Date.now())
    } catch {
      setStatus('unsaved')
    } finally { setSaving(false) }
  }, [onAutoSave])

  /** 内容变更时调用：触发 debounce 自动保存 */
  const touch = useCallback(() => {
    setDirty(true)
    setStatus(prev => (prev === 'published' ? 'draft' : 'unsaved'))
    if (timer.current) clearTimeout(timer.current)
    if (onAutoSave) timer.current = setTimeout(flush, autoSaveDelay)
  }, [autoSaveDelay, flush, onAutoSave])

  const saveDraft = useCallback(async () => {
    if (!onSaveDraft) return
    setSaving(true)
    try {
      await onSaveDraft()
      setStatus('draft'); setDirty(false); setLastSavedAt(Date.now())
    } catch { /* 由各页 toast 报错 */ } finally { setSaving(false) }
  }, [onSaveDraft])

  const publish = useCallback(async () => {
    if (!onPublish) return
    setSaving(true)
    try {
      await onPublish()
      setStatus('published'); setDirty(false)
    } catch { /* 由各页 toast 报错 */ } finally { setSaving(false) }
  }, [onPublish])

  // 离开页面强制 flush（混合 C）
  useEffect(() => {
    const handler = () => { if (dirty) void (onFlush || flush)() }
    const onVis = () => { if (document.visibilityState === 'hidden' && dirty) void (onFlush || flush)() }
    window.addEventListener('beforeunload', handler)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('beforeunload', handler)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [dirty, onFlush, flush])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { status, dirty, lastSavedAt, saving, touch, flush, saveDraft, publish }
}
