/**
 * 通用「有未保存内容」退出提醒 Hook
 *
 * 用法：useUnsavedChanges(hasChanges)
 * - hasChanges 为 true 时，关闭浏览器标签页/刷新时弹出确认框
 */

import { useEffect } from 'react'

export function useUnsavedChanges(hasChanges: boolean) {
  useEffect(() => {
    if (!hasChanges) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])
}
