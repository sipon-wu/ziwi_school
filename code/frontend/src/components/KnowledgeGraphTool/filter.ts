/**
 * 知识图谱过滤逻辑 — 纯函数，可独立测试
 * 从 KnowledgeGraph.tsx visibleNodes useMemo 抽出
 */
import type { KnowledgeNode, FilterParams } from './types'

/**
 * 按学科 / 年级进度 / 难度范围过滤可见节点
 * - subject: 精确匹配
 * - grade/semester: 累积包含（≤当前进度的历史节点全部可见）
 * - difficultyRange: 滑动条筛选
 */
export function filterKnowledgeNodes(
  nodes: KnowledgeNode[],
  params: FilterParams,
): KnowledgeNode[] {
  const { subject, grade, semester, difficultyRange = [1, 4] } = params

  return nodes
    .filter(n => n.subject === subject)
    .filter(n => {
      if (grade == null) return true
      const sv = (s: string) => (s === '上' ? 1 : 2)
      const cs = semester ? sv(semester) : 2
      if (n.grade < grade) return true
      if (n.grade === grade) return sv(n.semester) <= cs
      return false
    })
    .filter(n => {
      const d = parseInt(n.difficulty.replace('L', ''))
      return d >= difficultyRange[0] && d <= difficultyRange[1]
    })
}

/**
 * 按搜索文本过滤
 */
export function searchNodes(nodes: KnowledgeNode[], text: string): KnowledgeNode[] {
  if (!text.trim()) return nodes
  const kw = text.trim().toLowerCase()
  return nodes.filter(n =>
    n.name.toLowerCase().includes(kw) ||
    n.unit.toLowerCase().includes(kw) ||
    n.curriculum_code.toLowerCase().includes(kw),
  )
}
