// 小微上下文：分层记忆的「近期原文 + 当前焦点」两层。
//
// 原实现只保留最近 6 条纯文本（slice(-6)），且无焦点信息——
// 导致用户说"这个太挤了"时，小微无从得知指的是哪个资产。
// 本版在**保持对外签名不变**的前提下增强：
//   ① 窗口从 6 条放宽到 30 条，并按字符预算裁剪（而非按条数硬截）
//   ② 新增「当前焦点」（在看哪份课件、第几页、哪个资产）
//   ③ getXiaoweiContext() 自动把焦点拼在最前，使 5 个既有调用方零改动即获得焦点感知
//
// 长期画像（teacherProfile）与检索池（recall）属服务端能力，后续接入。

/** 用户当前正在查看的对象——小微归因指代性反馈（"这个""太多了"）的依据 */
export interface XiaoWeiFocus {
  /** 课件 / 文档 ID */
  materialId: string
  /** 页码（0 基） */
  slideIndex: number
  /** 当前资产 ID（装饰资产或结构组件） */
  assetId?: string
  /** 当前资产参数，支撑"改小一点"这类相对指令的计算 */
  assetParams?: Record<string, unknown>
  /** 版本 ID，发布后精确定位用 */
  versionId?: string
  /** 可读标题，便于拼进上下文 */
  title?: string
}

const STORAGE_KEY = 'xiaowei_last_prompts'
const FOCUS_KEY = 'xiaowei_focus'

/** 近期原文窗口上限（条） */
const MAX_RECENT = 30
/** 拼进 chat_context 的字符预算，超出则从最早的历史开始丢弃 */
const MAX_CHARS = 2000

let lastPrompts: string[] = []
let focus: XiaoWeiFocus | null = null

function readStore(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key: string, val: string | null) {
  try {
    if (val == null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, val)
  } catch {
    /* 隐私模式下 sessionStorage 不可用，静默降级为内存态 */
  }
}

export function pushXiaoweiPrompt(text: string) {
  const t = (text || '').trim()
  if (!t) return
  lastPrompts = [...lastPrompts, t].slice(-MAX_RECENT)
  writeStore(STORAGE_KEY, JSON.stringify(lastPrompts))
}

/** 设置当前焦点；传 null 表示离开编辑对象 */
export function setXiaoweiFocus(f: XiaoWeiFocus | null) {
  focus = f
  writeStore(FOCUS_KEY, f ? JSON.stringify(f) : null)
}

export function getXiaoweiFocus(): XiaoWeiFocus | null {
  return focus
}

/** 焦点的人类可读描述，供提示词消费 */
function describeFocus(f: XiaoWeiFocus): string {
  const seg: string[] = [`《${f.title || f.materialId}》`, `第 ${f.slideIndex + 1} 页`]
  if (f.assetId) seg.push(`资产 ${f.assetId}`)
  if (f.assetParams && Object.keys(f.assetParams).length) {
    const kv = Object.entries(f.assetParams)
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    seg.push(`当前参数 ${kv}`)
  }
  return seg.join(' · ')
}

/**
 * 按字符预算从最近的原文往回取，保证不超出预算。
 * 至少保留一条，避免长文本把上下文全部挤掉。
 */
function recentWithinBudget(): string {
  const out: string[] = []
  let len = 0
  for (let i = lastPrompts.length - 1; i >= 0; i--) {
    const t = lastPrompts[i]
    if (out.length && len + t.length > MAX_CHARS) break
    out.unshift(t)
    len += t.length + 1
  }
  return out.join('；')
}

/**
 * 供生成类接口作为 chat_context 传入。
 * 签名与语义保持兼容：无焦点时行为与旧版一致（近期原拼接）。
 */
export function getXiaoweiContext(): string {
  try {
    const raw = readStore(STORAGE_KEY)
    if (raw) lastPrompts = JSON.parse(raw) || lastPrompts
    const fRaw = readStore(FOCUS_KEY)
    focus = fRaw ? (JSON.parse(fRaw) as XiaoWeiFocus) : focus
  } catch {
    /* 解析失败则沿用内存态 */
  }

  const parts: string[] = []
  if (focus) parts.push(`[当前焦点] ${describeFocus(focus)}`)
  const recent = recentWithinBudget()
  if (recent) parts.push(recent)
  return parts.join('\n')
}

export function clearXiaoweiContext() {
  lastPrompts = []
  focus = null
  writeStore(STORAGE_KEY, null)
  writeStore(FOCUS_KEY, null)
}
