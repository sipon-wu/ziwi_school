/**
 * courseware-h5 —— 绘本式互动课件工具库（统一出口）
 *
 * 这是「小微创作中枢」的一个可复用 ProduceTarget 工具：
 * 给定 AI 课件 markdown（或结构化 Story），产出绘本式自包含 H5。
 *
 * 用法：
 *   import { mdToStory, buildStoryH5 } from '@/lib/courseware-h5'
 *   const story = mdToStory(md, { subject, grade, teacherName })
 *   const html  = buildStoryH5(story)          // 保存 / 注入 / 预览
 */

export * from './types'
export { mdToStory, storyToDebug } from './mdToStory'
export { buildStoryH5 } from './renderer'

import { mdToStory } from './mdToStory'
import { buildStoryH5 } from './renderer'
import type { Story } from './types'

/** 一站式：markdown → 绘本式 H5 字符串 */
export function markdownToStorybookH5(
  md: string,
  opts?: { title?: string; subject?: string; grade?: string; teacherName?: string; themeId?: string }
): string {
  const story: Story = mdToStory(md, opts)
  if (opts?.themeId) story.themeId = opts.themeId
  return buildStoryH5(story)
}
