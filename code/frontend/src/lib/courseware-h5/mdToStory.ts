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

import type { Story, StoryScene, StoryRole, StoryInteraction, ReadUnit, ReadAlongUnit, QuizUnit, SceneType } from './types'
import { ROLE_COLORS } from './types'

// 受控场景版式集合（v1，与 types.ts SceneType 同源；AI 只能在此范围内显式标注）
const SCENE_TYPES: SceneType[] = ['dialog', 'read', 'quiz', 'reveal', 'draw', 'focus', 'transition']

/**
 * 场景版式推断（无显式标注时用）：按"该页的主要教学动作"判定。
 * 优先级：quiz > reveal > draw > read(点读/跟读) > focus(纯重点无对话) > dialog(有对话) > transition(纯旁白)。
 * 旧内容只写 `scene`（dialog 语义），有对话即回落到 dialog，保证向后兼容。
 */
function inferSceneType(sc: StoryScene): SceneType {
  const it = sc.interaction?.type
  if (it === 'quiz') return 'quiz'
  if (it === 'reveal') return 'reveal'
  if (it === 'draw') return 'draw'
  if (it === 'read' || it === 'readalong') return 'read'
  if (sc.focus && !(sc.bubbles && sc.bubbles.length)) return 'focus'
  if (sc.bubbles && sc.bubbles.length) return 'dialog'
  return 'transition'
}

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
  const raw = m[1].trim()
  let matched = false
  // 形态 1：A（顾客），B（水果摊主） / A(顾客) B(摊主)
  const segRe = /([A-Za-z一-龥]{1,4})\s*[（(]\s*([^）)]+)\s*[）)]/g
  let mm: RegExpMatchArray | null
  while ((mm = segRe.exec(raw))) {
    const key = mm[1].trim()
    const name = mm[2].trim()
    ctx.roleAlias.set(key, name)
    inferRole(name, ctx, ctx.roles.size)
    matched = true
  }
  // 形态 2（真实生成内容，2026-09-03 修复的关键）：
  //   `**角色**:老师、小满、阿哲` —— 顿号/逗号分隔的裸角色名，无括号。
  // 历史缺陷：解析器只认形态 1，导致真实内容的角色从未注册，
  // 后续 `老师: 对话` 行因角色不在别名表而被判为非对话 → 全部落成旁白段落，
  // 场景气泡恒为空 → 每个 H5 场景视觉同构（"一个模子"的真正根因之一）。
  if (!matched) {
    raw.split(/[、，,；;]+/).map(p => p.trim()).filter(Boolean).forEach(chunk => {
      // 兼容 "A 顾客"（字母/短名 + 空格 + 称呼）与裸名 "老师"
      const sp = chunk.split(/\s+/)
      if (sp.length >= 2 && /^[A-Za-z一-龥]{1,2}$/.test(sp[0])) {
        ctx.roleAlias.set(sp[0], sp.slice(1).join(''))
        inferRole(sp.slice(1).join(''), ctx, ctx.roles.size)
      } else {
        ctx.roleAlias.set(chunk, chunk)
        inferRole(chunk, ctx, ctx.roles.size)
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
    if (line.startsWith('<!--')) {
      // 受控场景版式标注（v1）：`<!-- layout: scene-read -->` 显式指定场景类型；
      // 裸 `<!-- layout: scene -->` 是旧格式，视为"不锁定、交推断"，保证历史内容向后兼容。
      const lay = line.match(/<!--\s*layout:\s*(scene(?:-[a-z]+)?|[a-z]+)\s*-->/i)
      if (lay) {
        const raw = lay[1].toLowerCase()
        const type = raw.startsWith('scene-') ? raw.slice('scene-'.length) : raw
        if (type !== 'scene' && (SCENE_TYPES as string[]).includes(type)) {
          const sc = state.cur || scenes[scenes.length - 1]
          if (sc) sc.sceneType = type as SceneType
        }
        // 其它（误带的 PPT 版式名如 edu-goal 等）一律忽略：不建场景、不报错
        continue
      }
      // 互动注释仅在已有场景上附加；首个场景前出现的注释先缓存，场景建立时补挂
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
  // 场景版式定稿（v1）：显式标注优先；缺失时按"该页主要教学动作"推断（兼容历史 scene 内容）
  for (const sc of scenes) {
    if (!sc.sceneType) sc.sceneType = inferSceneType(sc)
  }
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
