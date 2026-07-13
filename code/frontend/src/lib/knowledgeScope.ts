import type { UseKnowledgePickerReturn } from '../hooks/useKnowledgePicker'

/**
 * 从知识点选取器解析「知识面」约束，供 AI 生成使用：
 * - knowledge_points：所选知识点名称（严格范围）
 * - prerequisite_points：所选知识点的前置知识点名称（基于静态图谱 prerequisites 映射）
 * - curriculum_codes：所选知识点对应的课标编码（用于「课标备注」，不污染正文）
 * 全部在前端用静态知识图谱解析，避免与数据库 ID 不匹配。
 */
export function buildKnowledgeScope(picker: UseKnowledgePickerReturn) {
  const kpNames = picker.selectedNodes.map((n: any) => n.name).filter(Boolean)
  const nameById = new Map(picker.knowledgeData.map((n: any) => [n.id, n.name]))
  const prereqNames: string[] = []
  picker.selectedNodes.forEach((n: any) => {
    ;(n.prerequisites || []).forEach((pid: string) => {
      const nm = nameById.get(pid)
      if (nm && !prereqNames.includes(nm) && !kpNames.includes(nm)) prereqNames.push(nm)
    })
  })
  const currCodes = picker.selectedNodes.map((n: any) => n.curriculum_code).filter(Boolean)
  return { knowledge_points: kpNames, prerequisite_points: prereqNames, curriculum_codes: currCodes }
}
