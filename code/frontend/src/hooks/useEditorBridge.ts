import { useState, useCallback } from 'react'

/**
 * P0-5 内容态桥接（页面级 content + 框架管交互）。
 * 只管 "AI生成→文档态" 的 loading/error/触发，content 本体留在页面级。
 * 各页把"调 AI 的函数"与"把结果写进自身 content 并切 doc 模式"通过参数注入。
 */
interface Options<T> {
  /** 页面传入的 AI 生成函数（可带小微对话上下文） */
  onGenerate: (chatContext?: string) => Promise<T>
  /** 把 AI 结果写入页面 content + 切到 doc 模式（各页自理，因 content 结构各异） */
  commitToDoc: (result: T) => void
}

export function useEditorBridge<T = any>(opts: Options<T>) {
  const { onGenerate, commitToDoc } = opts
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runGenerate = useCallback(async (chatContext?: string): Promise<T> => {
    setGenerating(true); setError(null)
    try {
      const result = await onGenerate(chatContext)
      commitToDoc(result)
      return result
    } catch (e: any) {
      setError(e?.message || '生成失败')
      throw e
    } finally {
      setGenerating(false)
    }
  }, [onGenerate, commitToDoc])

  return { generating, error, runGenerate }
}
