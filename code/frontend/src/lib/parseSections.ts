/**
 * 教案 markdown 分段解析
 * 将 AI 生成的 markdown 教案拆分为可编辑的结构化段落
 */

export interface LessonSection {
  id: string
  level: number       // 标题层级（1=主标题, 2=一级章节, 3=二级章节）
  title: string       // 章节标题（如"一、教学目标"）
  body: string        // 正文内容（不含标题行）
  collapsed: boolean  // 折叠状态
}

const SECTION_IDS = ['objectives', 'key_points', 'difficult_points', 'process', 'board_design', 'reflection']

/** 从 markdown 中解析出教案段落 */
export function parseSections(markdown: string): LessonSection[] {
  if (!markdown.trim()) return []
  const lines = markdown.split('\n')
  const sections: LessonSection[] = []
  let current: LessonSection | null = null
  let sectionIndex = 0

  for (const line of lines) {
    // 匹配 ## 或 ### 标题
    const hMatch = line.match(/^(#{2,4})\s+(.+)/)
    if (hMatch) {
      if (current) sections.push(current)
      const title = hMatch[2].replace(/[*_~`]/g, '').trim()
      sectionIndex++
      current = {
        id: SECTION_IDS[sectionIndex - 1] || `section-${sectionIndex}`,
        level: hMatch[1].length - 1,
        title,
        body: '',
        collapsed: false,
      }
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line
    } else if (line.trim()) {
      // 第一个标题之前的前导文字，作为"教案概览"段落
      sectionIndex++
      current = { id: 'overview', level: 1, title: '教案概览', body: line, collapsed: false }
    }
  }
  if (current) sections.push(current)

  // 清理各段末尾空白
  for (const s of sections) s.body = s.body.trim()
  return sections
}

/** 将段落合并回 markdown */
export function combineSections(sections: LessonSection[]): string {
  return sections
    .map(s => {
      const prefix = '#'.repeat(s.level + 1)
      const title = `${prefix} ${s.title}`
      return s.body ? `${title}\n${s.body}` : title
    })
    .join('\n\n')
}
