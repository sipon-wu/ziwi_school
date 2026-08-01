import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

/**
 * useAnnotations / useVersions — 批注 + 版本快照统一 hook（入库，跟随作品加载）。
 *
 * 锚点模型（anchor_type）：
 *   page = 课件按页（anchor={page:n}）
 *   text = TipTap 选中文字（anchor={text, from, to}）
 * 版本 payload 多态：课件=OutlineSlide[]、教案/试卷/习题=HTML字符串、组卷=questions数组。
 *
 * 状态铁律（后端强制）：版本仅草稿期可存/回退，发布(active)后 403。
 * 前端据此控制"保存当前版本/恢复此版本"按钮的可用性（isLocked=true 时禁用）。
 */

export interface AnnotationItem {
  id: string
  anchor_type: 'page' | 'text'
  anchor: string // JSON 字符串：{"page":3} 或 {"text":"...","from":n,"to":n}
  comment: string
  created_at: string
}

export interface VersionItem {
  id: string
  label: string
  payload: string // JSON 字符串
  created_at: string
}

/** resourceType: courseware|lesson_plan|exam|exercise_sheet|sheet */
export function useAnnotations(resourceType: string, resourceId: string | undefined) {
  const [items, setItems] = useState<AnnotationItem[]>([])
  const load = useCallback(async () => {
    if (!resourceId) { setItems([]); return }
    try {
      const r = await api<{ items: AnnotationItem[] }>(`/annotations?resource_type=${resourceType}&resource_id=${resourceId}`)
      setItems(r.items || [])
    } catch { setItems([]) }
  }, [resourceType, resourceId])

  useEffect(() => { load() }, [load])

  const add = useCallback(async (anchorType: 'page' | 'text', anchor: object, comment: string) => {
    if (!resourceId || !comment.trim()) return
    try {
      await api('/annotations', {
        method: 'POST',
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, anchor_type: anchorType, anchor: JSON.stringify(anchor || {}), comment: comment.trim() }),
      })
      await load()
    } catch { /* 忽略，交由 UI toast */ }
  }, [resourceType, resourceId, load])

  const remove = useCallback(async (id: string) => {
    try { await api(`/annotations/${id}`, { method: 'DELETE' }); await load() } catch { /* noop */ }
  }, [load])

  return { items, add, remove, reload: load }
}

/** isLocked: 作品已发布（active）→ 禁存/禁恢复 */
export function useVersions(resourceType: string, resourceId: string | undefined, isLocked: boolean) {
  const [items, setItems] = useState<VersionItem[]>([])
  const load = useCallback(async () => {
    if (!resourceId) { setItems([]); return }
    try {
      const r = await api<{ items: VersionItem[] }>(`/versions?resource_type=${resourceType}&resource_id=${resourceId}`)
      setItems(r.items || [])
    } catch { setItems([]) }
  }, [resourceType, resourceId])

  useEffect(() => { load() }, [load])

  /** 存快照，payload 任意可 JSON 序列化对象。返回是否成功（发布后被后端 403 拒绝） */
  const take = useCallback(async (label: string, payload: unknown): Promise<boolean> => {
    if (!resourceId || isLocked) return false
    try {
      await api('/versions', {
        method: 'POST',
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId, label, payload: JSON.stringify(payload) }),
      })
      await load()
      return true
    } catch { return false }
  }, [resourceType, resourceId, isLocked, load])

  /** 恢复：返回快照 payload（已 JSON.parse），发布后被后端 403 拒绝返回 null */
  const restore = useCallback(async (id: string): Promise<unknown | null> => {
    if (isLocked) return null
    try {
      const data = await api<{ item: { payload: string } }>(`/versions/${id}/restore`, { method: 'POST' })
      return JSON.parse(data.item?.payload || 'null')
    } catch { return null }
  }, [isLocked])

  return { items, take, restore, reload: load }
}
