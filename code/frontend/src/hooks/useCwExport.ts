/**
 * 导出菜单领域 hook（P0-1 拆分 · 2026-09-16）
 *
 * 只管"导出下拉"这一件事：开关、格式多选、点击外部关闭。
 * 与装饰簇同理：**返回值沿用组件内原命名**，JSX 与导出处理函数零改动。
 *
 * 为什么先切它：这一簇无跨领域副作用（不依赖提纲/生成/保存），
 * 是 God Component 里最安全的一刀 —— 先建立"可复制的拆分范式"，再动纠缠较深的簇。
 */
import { useEffect, useRef, useState } from 'react'

export type ExportFormatKey = 'ppt' | 'docx' | 'pdf' | 'h5'

export function useCwExport() {
  /** 导出下拉：非全屏顶栏用单一「导出 ▾」下拉，多选格式一键导出（节约版面） */
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportSel, setExportSel] = useState<Record<ExportFormatKey, boolean>>({
    ppt: true, docx: false, pdf: false, h5: false,
  })
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [exportMenuOpen])

  return { exportMenuOpen, setExportMenuOpen, exportSel, setExportSel, exportMenuRef }
}
