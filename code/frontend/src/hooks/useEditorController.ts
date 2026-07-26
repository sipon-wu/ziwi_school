import { useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useEditorLifecycle, type EditorStatus } from './useEditorLifecycle'

/**
 * useEditorController — 编辑器统一神经中枢（正根）。
 *
 * 之前六页编辑器各自从 pathname/searchParams 抠态、各自写保存/生成、语义各自命名，
 * 根是歪的。本 hook 把主干全部收口到框架层，页面只注入三样差异：
 *   1. 生命周期回调（onAutoSave / onSaveDraft / onPublish）
 *   2. AI 生成回调（onGenerate → onCommit）
 *   3. 页面差异 UI（传给 EditorLayout 的 children）
 *
 * 态判定铁律（框架统一，页面不可覆盖）：
 *   /xxx/new          → viewMode = 'new'
 *   /xxx/:id/edit     → viewMode = 'edit'
 *   /xxx/:id 或 /:id/view → viewMode = 'view'
 *
 * 语义统一铁律：
 *   workMode: 'ai' | 'doc'（不再有 primary/secondary/edit/preview 五套方言）
 *   viewMode='new' → 默认 ai；edit → 默认 doc；view → doc + readonly
 */

type ViewMode = 'new' | 'edit' | 'view'
type WorkMode = 'ai' | 'doc'

interface EditorControllerOptions<T = any> {
  /** 可选：资源标识（仅用于日志/调试） */
  resourceType?: string

  // ─── 生命周期回调（由页面注入，框架统一调度） ───
  /** 自动保存（debounce 8s + 失焦 flush），不传则关闭 */
  onAutoSave?: () => Promise<void>
  /** 显式保存草稿 */
  onSaveDraft?: () => Promise<void>
  /** 发布 */
  onPublish?: () => Promise<void>
  /** debounce 毫秒，默认 8000 */
  autoSaveDelay?: number

  // ─── AI 生成回调（由页面注入，框架管理 loading/error/切doc） ───
  /** 调 AI API 的函数，返回原始结果 */
  onGenerate?: (chatContext?: string) => Promise<T>
  /** 生成结果写入页面 content（框架自动在生成后切 doc 模式） */
  onCommit?: (result: T) => void
}

interface EditorController<T = any> {
  // ── 态（框架统一判定） ──
  /** 模型态：新建 / 编辑 / 查看 */
  viewMode: ViewMode
  /** 工作模式：AI 生成态 / 文档编辑态 */
  workMode: WorkMode
  /** 查看态只读（viewMode='view' 时 true） */
  readOnly: boolean
  /** 切换 AI/文档模式 */
  setWorkMode: (m: WorkMode) => void
  /**
   * 查看态点「编辑」原地解锁。
   * 不 unmonut 组件，路由用 replaceState 同步为 /edit 后缀。
   */
  forceEdit: () => void

  // ── 生命周期（来自 useEditorLifecycle） ──
  status: EditorStatus
  saving: boolean
  /** 内容变更时调用，触发 debounce 自动保存 */
  touch: () => void
  saveDraft: () => Promise<void>
  publish: () => Promise<void>

  // ── AI 生成 ──
  generating: boolean
  generateError: string | null
  /** 触发 AI 生成（自动管理 loading → 生成 → commit → 切 doc） */
  runGenerate: (chatContext?: string) => Promise<T | undefined>
}

export type { ViewMode, WorkMode, EditorControllerOptions, EditorController }

/** 从 pathname 统一判定 viewMode */
function parseViewMode(pathname: string): ViewMode {
  if (pathname.endsWith('/new')) return 'new'
  if (pathname.includes('/edit')) return 'edit'
  return 'view'
}

/** 按 viewMode 给出默认 workMode */
function defaultWorkMode(vm: ViewMode): WorkMode {
  if (vm === 'new') return 'ai'
  return 'doc'
}

export function useEditorController<T = any>(
  opts: EditorControllerOptions<T> = {}
): EditorController<T> {
  const { pathname } = useLocation()
  const {
    onAutoSave, onSaveDraft, onPublish, autoSaveDelay,
    onGenerate, onCommit,
  } = opts

  // ── viewMode：路由统一判定 ──
  const initialViewMode = parseViewMode(pathname)

  // ── forceEdit：查看态 → 编辑态原地解锁 ──
  const [forceEdit, setForceEdit] = useState(false)
  const viewMode: ViewMode = forceEdit && initialViewMode === 'view' ? 'edit' : initialViewMode
  const readOnly = viewMode === 'view'

  // ── workMode：统一语义 ai/doc ──
  const [workMode, setWorkMode] = useState<WorkMode>(() => defaultWorkMode(viewMode))

  // ── 生命周期：复用 useEditorLifecycle ──
  const lifecycle = useEditorLifecycle({
    onAutoSave, onSaveDraft, onPublish,
    autoSaveDelay,
  })

  // ── AI 生成管道：框架统一管理 loading/error/切 doc ──
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const runGenerate = useCallback(async (chatContext?: string): Promise<T | undefined> => {
    if (!onGenerate) return undefined
    setGenerating(true)
    setGenerateError(null)
    try {
      const result = await onGenerate(chatContext)
      if (onCommit) onCommit(result)
      // 生成完成后自动切到文档模式
      if (workMode === 'ai') setWorkMode('doc')
      return result
    } catch (e: any) {
      const msg = e?.message || '生成失败'
      setGenerateError(msg)
      throw e
    } finally {
      setGenerating(false)
    }
  }, [onGenerate, onCommit, workMode])

  return {
    viewMode,
    workMode,
    readOnly,
    setWorkMode,
    forceEdit: () => setForceEdit(true),

    status: lifecycle.status,
    saving: lifecycle.saving,
    touch: lifecycle.touch,
    saveDraft: lifecycle.saveDraft,
    publish: lifecycle.publish,

    generating,
    generateError,
    runGenerate,
  }
}
