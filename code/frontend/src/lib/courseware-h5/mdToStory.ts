/**
 * mdToStory —— 把"AI 课件 markdown"解析为绘本 Story
 *
 * 同时兼容两套输入：
 *
 * 【A 套 · 绘本原生标记（手写 / 进阶 prompt）】
 *   # 课件标题
 *   > meta: subject=英语; grade=三年级; teacher=王老师
 *   ## 去超市买水果
 *   [小明] 妈妈，我想吃苹果！            ← 方括号角色对话
 *   <!-- read: 苹果 apple / 香蕉 banana -->
 *   <!-- readalong: I like apples. -->
 *   <!-- quiz: 苹果用英语怎么说? | apple | banana | cat | 0 -->
 *
 * 【B 套 · 现有 AI 讲稿式输出（/api/ai/courseware/generate 现状）】
 *   ## 五、新知探究：购物场景对话
 *   **角色**：A（顾客），B（水果摊主）
 *   **对话原文**：
 *   A: Hello! Do you have apples?
 *   B: Yes, we have red apples.
 *   **关键句型框**：
 *   - Can I help you?
 *   - What color do you like?
 *   **跟读提示句**：点击句子可点读音频。
 *   <!-- layout: edu-explain -->
 *
 * 解析器对 B 套做"稳健兼容"：A/B: 行识别为对话气泡；**角色**：建角色表；
 * **跟读提示句** 把上下文对话句转 readalong；**关键句型框** 列表项转点读；
 * `---` 与 `## ` 都切分场景。即使 AI 不遵循 A 套标记，也能产出可读绘本。
 */

import type { Story, StoryScene, StoryRole, StoryInteraction, ReadUnit, ReadAlongUnit, QuizUnit } from './types'
import { ROLE_COLORS } from './types'

function escAttr(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface ParseCtx {
  roles: Map<string, StoryRole>
  /** 角色别名映射：A→顾客, B→水果摊主（来自 **角色**：A（顾客）） */
  roleAlias: Map<string, string>
  title: string
  subject: string
  grade: string
  teacherName: string
  /** 当前块类型：dialog(对话原文/示例对话) / sentences(关键句型框) / readalong(跟读提示句) / none */
  block: 'dialog' | 'sentences' | 'readalong' | 'none'
}

function parseMeta(line: string, ctx: ParseCtx) {
  const m = line.match(/meta\s*:(.*)/i)
  if (!m) return
  m[1].split(';').forEach(pair => {
    const [k, v] = pair.split(/[:=]/)
    if (!k || !v) return
    const key = k.trim().toLowerCase()
    const val = v.trim()
    if (key === 'subject') ctx.subject = val
    else if (key === 'grade') ctx.grade = val
    else if (key === 'teacher' || key === 'teachername') ctx.teacherName = val
    else if (key === 'title') ctx.title = val
  })
}

function parseDialogLine(line: string): { role?: string; text: string } | null {
  const m = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
  if (m) return { role: m[1].trim(), text: m[2].trim() }
  return null
}

/** 解析 **角色**：A（顾客），B（水果摊主） 这类角色声明 */
function parseRoleDecl(line: string, ctx: ParseCtx) {
  const m = line.match(/\*\*角色\*\*[：:]\s*(.*)/)
  if (!m) return false
  // 形如 A（顾客），B（水果摊主） 或 A(顾客) B(摊主)
  const segRe = /([A-Za-z一-龥]{1,4})\s*[（(]\s*([^）)]+)\s*[）)]/g
  let mm: RegExpMatchArray | null
  while ((mm = segRe.exec(m[1]))) {
    const key = mm[1].trim()
    const name = mm[2].trim()
    ctx.roleAlias.set(key, name)
    inferRole(name, ctx, ctx.roles.size)
  }
  // 退化：无括号的 "A 顾客 B 摊主"
  if (![...ctx.roleAlias.keys()].length) {
    m[1].split(/[，,]/).forEach(p => {
      const parts = p.trim().split(/\s+/)
      if (parts.length >= 2) {
        ctx.roleAlias.set(parts[0], parts.slice(1).join(''))
        inferRole(parts.slice(1).join(''), ctx, ctx.roles.size)
      }
    })
  }
  return true
}

/** 解析 **块标题**： 识别对话原文/示例对话/关键句型框/跟读提示句 */
function parseBlockHeader(line: string, ctx: ParseCtx): boolean {
  if (/\*\*对话原文\*\*|\*\*示例对话\*\*/.test(line)) { ctx.block = 'dialog'; return true }
  if (/\*\*关键句型框\*\*/.test(line)) { ctx.block = 'sentences'; return true }
  if (/\*\*跟读提示句\*\*/.test(line)) { ctx.block = 'readalong'; return true }
  // 其他 **xxx** 行结束当前块
  if (/^\*\*[^*]+\*\*\s*[：:]/.test(line)) { ctx.block = 'none' }
  return false
}

/** 识别 "A: 文本" / "B: 文本" 冒号对话（A/B 是声明过的角色或单字母大写） */
function parseColonDialog(line: string, ctx: ParseCtx): { role?: string; text: string } | null {
  const m = line.match(/^\s*([A-Za-z一-龥]{1,4})\s*[:：]\s*(.*)$/)
  if (!m) return null
  const key = m[1].trim()
  // 仅在 A/B 类对话角色或已声明别名时才认作对话，避免误伤普通 "注意：xxx"
  if (ctx.roleAlias.has(key) || /^[A-Z]$/.test(key)) {
    const text = m[2].trim()
    // 过滤练习题里的假对话：含填空符、或前面带数字序号（"1. A: ___"）
    if (/_+/.test(text) || /^\d+[.)]\s/.test(line)) return null
    const name = ctx.roleAlias.get(key) || key
    return { role: name, text }
  }
  return null
}

function parseRead(raw: string): ReadUnit[] {
  // 支持 "苹果 apple / 香蕉 banana" 或 "apple / banana"
  return raw.split('/').map(s => s.trim()).filter(Boolean).map(part => {
    const seg = part.split(/\s+/)
    // 含中文+英文：中文在前作提示
    if (/[一-龥]/.test(part) && /[a-zA-Z]/.test(part)) {
      const cn = seg.filter(w => /[一-龥]/.test(w)).join('')
      const en = seg.filter(w => /[a-zA-Z]/.test(w)).join(' ')
      return { text: en, hint: cn }
    }
    return { text: part }
  })
}

function parseReadAlong(raw: string): ReadAlongUnit[] {
  return raw.split('/').map(s => s.trim()).filter(Boolean).map(t => ({ text: t }))
}

function parseQuiz(raw: string): QuizUnit | null {
  // q | a | b | c | correctIndex
  const parts = raw.split('|').map(s => s.trim())
  if (parts.length < 3) return null
  const question = parts[0]
  const options = parts.slice(1, parts.length - 1)
  const correct = parseInt(parts[parts.length - 1], 10)
  if (isNaN(correct)) return null
  return { question, options, correct }
}

function applyInteraction(line: string, scene: StoryScene, ctx: ParseCtx) {
  let m: RegExpMatchArray | null
  if ((m = line.match(/<!--\s*read\s*:(.*?)-->/i))) {
    scene.interaction = scene.interaction || { type: 'read' }
    scene.interaction.type = 'read'
    scene.interaction.reads = [...(scene.interaction.reads || []), ...parseRead(m[1])]
  } else if ((m = line.match(/<!--\s*readalong\s*:(.*?)-->/i))) {
    scene.interaction = scene.interaction || { type: 'readalong' }
    scene.interaction.type = 'readalong'
    scene.interaction.sentences = [...(scene.interaction.sentences || []), ...parseReadAlong(m[1])]
  } else if ((m = line.match(/<!--\s*quiz\s*:(.*?)-->/i))) {
    const q = parseQuiz(m[1])
    if (q) { scene.interaction = { type: 'quiz', quiz: q } }
  } else if ((m = line.match(/<!--\s*reveal\s*:(.*?)-->/i))) {
    const seg = m[1].split('=>')
    scene.interaction = { type: 'reveal', prompt: (seg[0] || '').trim(), answer: (seg[1] || '').trim() }
  } else if ((m = line.match(/<!--\s*draw\s*:(.*?)-->/i))) {
    scene.interaction = { type: 'draw', drawTitle: m[1].trim(), drawHint: '在此处描绘你的想法' }
  } else if ((m = line.match(/<!--\s*focus\s*:(.*?)-->/i))) {
    scene.focus = m[1].trim()
  } else if ((m = line.match(/<!--\s*audio\s*:(.*?)-->/i))) {
    scene.interaction = { type: 'audio', src: m[1].trim() }
  } else if ((m = line.match(/<!--\s*video\s*:(.*?)-->/i))) {
    scene.interaction = { type: 'video', src: m[1].trim() }
  } else if ((m = line.match(/<!--\s*popup\s*:(.*?)-->/i))) {
    const seg = m[1].split('=>')
    scene.interaction = { type: 'popup', triggerText: (seg[0] || '').trim(), popupContent: (seg[1] || '').trim() }
  }
}

function inferRole(name: string, ctx: ParseCtx, idx: number): StoryRole {
  if (ctx.roles.has(name)) return ctx.roles.get(name)!
  const role: StoryRole = {
    name,
    avatar: name.slice(0, 1),
    color: ROLE_COLORS[ctx.roles.size % ROLE_COLORS.length],
  }
  ctx.roles.set(name, role)
  return role
}

export function mdToStory(md: string, opts?: { title?: string; subject?: string; grade?: string; teacherName?: string; themeId?: string }): Story {
  const lines = (md || '').split(/\r?\n/)
  const ctx: ParseCtx = {
    roles: new Map(),
    roleAlias: new Map(),
    title: opts?.title || '',
    subject: opts?.subject || '',
    grade: opts?.grade || '',
    teacherName: opts?.teacherName || '',
    block: 'none',
  }
  const scenes: StoryScene[] = []
  const state: { cur: StoryScene | null } = { cur: null }
  const pendingComments: string[] = []

  const ensureScene = (): StoryScene => {
    if (!state.cur) { state.cur = { bubbles: [], mood: 'warm' }; scenes.push(state.cur) }
    return state.cur
  }

  const newScene = (title: string, mood: StoryScene['mood']): StoryScene => {
    state.cur = { title, bubbles: [], mood }
    scenes.push(state.cur)
    // 把首个场景之前的缓存注释补加到本场景
    pendingComments.forEach(c => applyInteraction(c, state.cur!, ctx))
    pendingComments.length = 0
    return state.cur
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    // --- 分隔符：强制切分场景（AI 讲稿式常用）
    if (/^---+$/.test(line)) {
      ctx.block = 'none'
      if (state.cur) { const m = state.cur.mood || 'warm'; newScene('', m) }
      continue
    }
    if (line.startsWith('# ') && !ctx.title) { ctx.title = line.slice(2).trim(); continue }
    if (line.startsWith('> ')) { parseMeta(line.slice(2), ctx); continue }
    // layout 注释仅为语义提示，不单独建场景；互动注释也仅在已有场景上附加
    if (line.startsWith('<!--')) {
      if (!state.cur) { pendingComments.push(line) }
      else { applyInteraction(line, state.cur, ctx) }
      continue
    }
    // **角色**：A（顾客），B（摊主）
    if (parseRoleDecl(line, ctx)) { continue }
    // **对话原文** / **示例对话** / **关键句型框** / **跟读提示句** 等块标题
    if (parseBlockHeader(line, ctx)) { continue }
    if (line.startsWith('## ')) {
      newScene(line.slice(3).trim(), 'warm')
      ctx.block = 'none'
      continue
    }
    if (line.startsWith('### ')) {
      newScene(line.slice(4).trim(), 'playful')
      ctx.block = 'none'
      continue
    }
    // 冒号对话 A: 文本（AI 讲稿式）
    const cd = parseColonDialog(line, ctx)
    if (cd) {
      inferRole(cd.role || '老师', ctx, scenes.length)
      const sc = ensureScene()
      sc.bubbles!.push({ role: cd.role, text: cd.text })
      // 跟读块内：把该句同时登记为跟读句
      if (ctx.block === 'readalong') {
        sc.interaction = sc.interaction || { type: 'readalong' }
        sc.interaction.type = 'readalong'
        sc.interaction.sentences = [...(sc.interaction.sentences || []), { text: cd.text }]
      }
      continue
    }
    // 方括号对话 [A] 文本（绘本原生）
    const d = parseDialogLine(line)
    if (d) {
      // 方括号内若为说明性标签（对话/图/注/步骤等）或文本为空，不当对话气泡，降级为旁白/场景标题
      const isLabel = /^(对话|图|注|步骤|提示|说明|场景|分组|活动)\b/.test(d.role || '')
      if (isLabel || !d.text) {
        const sc = ensureScene()
        if (!sc.title) sc.title = d.role
        else sc.narration = (sc.narration ? sc.narration + ' ' : '') + d.role + (d.text ? '：' + d.text : '')
        continue
      }
      inferRole(d.role || '老师', ctx, scenes.length)
      ensureScene().bubbles!.push({ role: d.role, text: d.text })
      continue
    }
    // 关键句型框 下的列表项 → 点读单元
    if (ctx.block === 'sentences' && /^[-*]\s+/.test(line)) {
      const word = line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim()
      if (word) {
        const sc = ensureScene()
        sc.interaction = sc.interaction || { type: 'read' }
        sc.interaction.type = 'read'
        sc.interaction.reads = [...(sc.interaction.reads || []), { text: word }]
      }
      continue
    }
    // 对话原文块内的纯对话行（已被 parseColonDialog 覆盖，这里兜底）
    // 旁白：去 markdown 列表符号
    const narration = line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '')
    ensureScene().narration = (ensureScene().narration ? ensureScene().narration + ' ' : '') + narration
  }

  if (scenes.length === 0) {
    scenes.push({ title: ctx.title || '课件', narration: '（暂无内容）', bubbles: [], mood: 'warm' })
  }

  const roles = Array.from(ctx.roles.values())
  return {
    title: ctx.title || opts?.title || '互动课件',
    subject: ctx.subject,
    grade: ctx.grade,
    teacherName: ctx.teacherName,
    // 绘本式 H5 默认风格基线：卡通化装饰层 + 卡通图标（见方案文档 §5）。
    // 缺省 storybook（童趣绘本），保证 AI 不指定主题时卡通装饰一定生效，而非裸排版。
    themeId: opts?.themeId || 'storybook',
    roles,
    scenes,
  }
}

/** 供调试/测试：导出一个场景的精简文本 */
export function storyToDebug(s: Story): string {
  return s.scenes.map((sc, i) => `#${i + 1} ${sc.title || ''} bubbles=${sc.bubbles?.length || 0} interaction=${sc.interaction?.type || '-'}`).join('\n')
}
