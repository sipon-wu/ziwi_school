/**
 * 内部诊断视图开关（**缺省关闭** · 2026-09-15）
 *
 * 背景：编辑器里有些信息是给研发/QA 看的，教师看了不仅没用还会困惑 ——
 * 典型是课件页左栏的「来源（生成配方）」面板：知识面来源 `teacher|kg`、前置来源
 * `qian_zhi|parent_id`、发散边界 `orbit/edge/beyond_band`、生成模型 `qwen-plus`。
 * 教师反馈"这是啥，应该隐藏的吧"。
 *
 * 与其删掉（QA 复现缺陷时正需要它），不如**默认隐藏 + 显式开关**：
 *   · URL 带 `?debug=1`（一次性、可分享的复现链接）
 *   · 或 localStorage 里 `zhiwei_debug=1`（本机长期打开）
 * 两者取或。缺省（教师正常使用）一律看不到，符合"缺省规则"——不依赖使用者自觉。
 */
export function isDebugView(): boolean {
  try {
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true
    return window.localStorage.getItem('zhiwei_debug') === '1'
  } catch {
    return false
  }
}
