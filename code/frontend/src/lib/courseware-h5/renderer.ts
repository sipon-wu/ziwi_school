/**
 * renderer —— 绘本式情景课件 HTML 渲染器（自包含，无外部依赖）
 *
 * 输出一段完整 <style> + <div> + <script>，可直接注入页面或保存为 .html 文件。
 * 配套 pager.ts / interactive.ts 的运行时逻辑已内联（保证"保存为独立 H5 文件"也能用）。
 */

import type { Story, StoryScene, StoryRole, StoryInteraction } from './types'
import { STORY_THEMES, ROLE_COLORS } from './types'
import { resolveAssetParams } from '../visualAsset/types'
import { getAssetsByStyle } from '../visualAsset/presets'
import { pickDecoGlyphs, styleKeyFromThemeId } from '../visualAsset/motifPools'

import { styleSpec, styleStructure, STYLE_ORDER, STYLE_TITLE_PX, H5_CONTENT_PX, splitTitle, TYPE_SCALE } from '../styleRegistry'
import { parseStyleDNA, getTheme, type StyleMorph } from '../pptThemes'
// 版面底层法则 → token（缺省规则单一真源，见 lib/layoutLaw.ts；数字出处 = 媒介纪律-PPT/H5）
import { SPACE, TEXT, H5 as H5LAW } from '../layoutLaw'

/** 把色值按 ratio 混入白色，得到浅色调（保持绘本式浅底可读） */
function mixWhite(hex: string, ratio: number): string {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return '#FFFDF8'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const m = (c: number) => Math.round(c + (255 - c) * ratio)
  const to2 = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to2(m(r))}${to2(m(g))}${to2(m(b))}`
}

/**
 * H5 绘本主题解析：styleDNA 优先，themeId 仅兜底（与 PPT 的 resolveTheme 同策略）。
 * 把 styleDNA 的 colors 映射成 STORY_THEMES 配色形状，并保持浅底
 * （card 固定浅色、背景用主色/强调色的浅色调），避免深底压垮童趣版式。
 * 无合法 styleDNA → 回退 STORY_THEMES[themeId]。
 */
/**
 * 库内 CwTheme id（fr-mint / zgf-ink-wash / te-quantum-blue …）→ 绘本浅底配色。
 *
 * 决策（2026-09-11）：**主题管色、风格管形**，两者维度分离、不再争"色"。
 * - 主题管色：无 color_root 的存量课件按其 CwTheme **本色**派生浅底（水墨保墨灰），
 *   且与 PPT 端同一 theme_id 同族配色 → 跨端一致；
 * - 风格管形：骨架/形态/母题由 STYLE_PREFIX_LAYOUT / STYLE_PREFIX_MORPH 承担
 *   （风格不靠"换色"体现，与产品原则"不要只换颜色换图标"一致）。
 * 修复背景：此前 STORY_THEMES 未命中即回落 storybook → 6 个主题颜色完全相同。
 */
function cwThemeToStory(themeId: string): typeof STORY_THEMES[string] {
  const t = getTheme(themeId)
  const primary = `#${t.primary}`
  const accent = `#${t.bullet || t.primary}`
  return {
    bg1: mixWhite(primary, 0.80),
    bg2: mixWhite(accent, 0.84),
    card: '#FFFDF8',
    accent: primary,
    accent2: accent,
    text: t.body ? `#${t.body}` : '#3A2E2E',
    ink: t.subtle ? `#${t.subtle}` : '#5A4A4A',
    deco: STORY_THEMES.storybook.deco,
  }
}

function resolveStoryTheme(colorRoot: unknown, themeId?: string): typeof STORY_THEMES[string] {
  const key = themeId || 'storybook'
  // 显式 H5 皮肤 → 库内 CwTheme 本色（主题管色）→ storybook
  const base = STORY_THEMES[key] || cwThemeToStory(key)
  const sd = parseStyleDNA(colorRoot)
  if (!sd) return base
  const primary = sd.primary
  const accent = sd.accent || primary
  return {
    bg1: mixWhite(primary, 0.80),
    bg2: mixWhite(accent, 0.84),
    card: '#FFFDF8',
    accent: primary,
    accent2: accent,
    text: sd.body || '#3A2E2E',
    ink: sd.subtle || '#5A4A4A',
    deco: base.deco,
  }
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function roleColor(roles: StoryRole[] | undefined, name: string | undefined, idx: number): string {
  if (name && roles) {
    const r = roles.find(x => x.name === name)
    if (r && r.color) return r.color
  }
  return ROLE_COLORS[idx % ROLE_COLORS.length]
}

/* ────────────────────────────────────────────────
 * 形态字典（styleDNA morph，2026-09-03）——让"风格"不只换色，还改变形态。
 * 三套默认形态按主题气质固化（forest→疏朗自然，night→紧凑沉静，storybook→活跃童趣）；
 * 若 styleDNA 显式给出 morph 则覆盖主题默认（AI 未来可产出）。
 * ──────────────────────────────────────────────── */
const THEME_MORPH: Record<string, StyleMorph> = {
  storybook: { density: 'normal', motion: 'lively', motif: 'playful' },
  forest:    { density: 'loose',  motion: 'lively', motif: 'nature' },
  night:     { density: 'tight',  motion: 'calm',   motif: 'starlit' },
  ocean:     { density: 'normal', motion: 'calm',   motif: 'nature' },
}

// 形态（morph）与骨架类（layout）的口径已统一到 styleRegistry（2026-09-11）：
// theme_id 前缀 → 风格 key → { morph, h5Layout }，不再在本文件重复维护前缀表。
// 骨架本身的 CSS 仍在本文件下方（.layout-china / .layout-tech …）。

/* ────────────────────────────────────────────────
 * 风格骨架语言（layout）：
 * morph（density/motion/motif）只改疏密/节奏/母题，仍属"换色换 SVG"范畴——
 * 用户明确"不要变点颜色换点 SVG 图标就表示不同风格"。
 * 真正的「风格驱动骨架」须改变**版面结构**：留白比例、分栏方式、边框形态、卡片几何。
 * 骨架类由 styleRegistry 统一给出；风格卡的语义层由 AI 侧消费
 * （见 api_server 的 _load_style_layout_language）。
 * ──────────────────────────────────────────────── */
function resolveStoryLayout(themeId?: string): string {
  const key = styleKeyFromThemeId(themeId)
  return key ? styleSpec(key).h5Layout : 'basic'
}

/* ────────────────────────────────────────────────
 * 由共享结构语汇生成 H5 结构 CSS（2026-09-11 口径统一）
 *
 * 此前这些声明是**手写在下方 CSS 里**的，与 PPT 端各写一套 → 必然漂移。
 * 现在两端消费同一份 `STYLE_STRUCTURE`：H5 生成 CSS，PPT 渲染内联样式。
 * 覆盖六个结构维度：底纹 / 边栏 / 角标 / 圆角 / 标题形态 /（列表记号见 PPT 端）。
 * H5 特有的栅格与内边距（scene padding、stage 分栏）属响应式调优，仍由下方静态 CSS 负责。
 * ──────────────────────────────────────────────── */
/** 场景标题 HTML：长标题拆「主标题 + 副标题」（共享规则 splitTitle，与 PPT 同源） */
function sceneTitleHtml(title?: string): string {
  if (!title) return ''
  const { main, sub } = splitTitle(title)
  return `<div class="scene-title">${esc(main)}${sub ? `<span class="scene-title-sub">${esc(sub)}</span>` : ''}</div>`
}

function structureCssFromTokens(): string {
  const seen = new Set<string>()
  const rules: string[] = ['body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;}']
  for (const k of STYLE_ORDER) {
    const sp = styleSpec(k)
    const cls = `layout-${sp.h5Layout}`
    if (seen.has(cls)) continue   // flat/business/basic 同为 basic，只出一次
    seen.add(cls)
    const t = styleStructure(k)
    const accent = 'var(--accent)'

    // ① 底纹
    const tex = t.texture === 'grid'
      ? `linear-gradient(color-mix(in srgb, ${accent} 10%, transparent) 1px, transparent 1px),linear-gradient(90deg, color-mix(in srgb, ${accent} 10%, transparent) 1px, transparent 1px)`
      : t.texture === 'dots'
        ? `radial-gradient(color-mix(in srgb, ${accent} 16%, transparent) 2.4px, transparent 3px)`
        : 'none'
    const size = t.texture === 'grid' ? '26px 26px' : '32px 32px'
    rules.push(`body.${cls}::after{background-image:${tex};background-size:${size};}`)

    // ② 左边栏（卷轴书脊 / 细线 / 编号条）
    const rail = t.rail === 'scroll'
      ? `content:"";position:absolute;left:3.4%;top:9%;bottom:9%;width:5px;border-left:2px solid ${accent};background:color-mix(in srgb, ${accent} 12%, transparent);border-radius:2px;`
      : t.rail === 'rule'
        ? `content:"";position:absolute;left:3%;top:10%;bottom:10%;width:1px;background:color-mix(in srgb, ${accent} 42%, transparent);`
        : t.rail === 'index'
          ? `content:"";position:absolute;left:0;top:11%;width:7px;height:44px;background:repeating-linear-gradient(180deg, ${accent} 0 4px, transparent 4px 12px);`
          : ''
    if (rail) rules.push(`.${cls} .scene{position:relative;}\n.${cls} .scene::before{${rail}}`)

    // ③ 角标（三角 / 印章）
    const corner = t.corner === 'triangle'
      ? `content:"";position:absolute;right:0;top:0;width:44px;height:44px;background:${accent};clip-path:polygon(100% 0,100% 100%,0 0);`
      : t.corner === 'seal'
        ? `content:"";position:absolute;right:16px;top:14px;width:26px;height:26px;border:2px solid color-mix(in srgb, ${accent} 55%, transparent);border-radius:3px;`
        : ''
    if (corner) rules.push(`.${cls} .scene::after{${corner}}`)

    // ④ 卡片圆角
    rules.push(`.${cls} .narration,.${cls} .interact,.${cls} .bubble,.${cls} .read-word,.${cls} .quiz-opt{border-radius:${t.radius}px;}`)

    // ⑤ 字号层级（共享规则）：标题由风格给定，内容元素**一律封顶到"标题 - 2px"**，
    //    这样"内容比标题还大"在结构上不可能发生（此前极简标题 20px / 读卡 24px 就是倒挂）。
    const titlePx = STYLE_TITLE_PX[k]
    // 标题最终字号 = 风格字号 × 密度/形态微调（--title-boost）；
    // 内容一律封顶到"标题 - 2px" → **结构上不可能出现内容比标题大**。
    // 选择器带 `.scene` 提高特异性，否则压不过 `.scene.sparse/.dense` 里的内容字号（0,3,0）。
    rules.push(`.${cls}{--fs-title:${titlePx}px;}`)
    rules.push(`.${cls} .scene .scene-title{font-size:calc(var(--fs-title) * var(--title-boost,1));flex-wrap:wrap;}`)
    // 副标题：主标题的 0.6 倍（有下限，避免过小），换行独占一行
    rules.push(
      `.${cls} .scene .scene-title-sub{flex-basis:100%;font-weight:600;letter-spacing:0;opacity:.8;margin-top:2px;` +
      `font-size:max(calc(var(--fs-title) * var(--title-boost,1) * 0.6), ${TYPE_SCALE.caption + 2}px);}`,
    )
    const cap = `calc(var(--fs-title) * var(--title-boost,1) - 2px)`
    rules.push(
      `.${cls} .scene .read-word{font-size:min(${H5_CONTENT_PX.readWord}px, ${cap});}` +
      `.${cls} .scene .quiz-opt{font-size:min(${H5_CONTENT_PX.quizOpt}px, ${cap});}` +
      `.${cls} .scene .reveal-btn{font-size:min(${H5_CONTENT_PX.revealBtn}px, ${cap});}` +
      `.${cls} .scene .narration{font-size:min(${H5_CONTENT_PX.narration}px, ${cap});}` +
      `.${cls} .scene .bubble-text{font-size:min(17px, ${cap});}`,
    )
    // sparse 档（填充率<0.62）：内容字号**受控放大 15%** 把画布撑满，
    // 但依然封在"标题 - 2px"之下 → 不破坏"标题 > 内容"（此前 sparse 的放大被封顶规则压住，等于失效）
    const grow = (v: number) => Math.round(v * 1.15)
    rules.push(
      `.${cls} .scene.sparse .read-word{font-size:min(${grow(H5_CONTENT_PX.readWord)}px, ${cap});}` +
      `.${cls} .scene.sparse .quiz-opt{font-size:min(${grow(H5_CONTENT_PX.quizOpt)}px, ${cap});}` +
      `.${cls} .scene.sparse .reveal-btn{font-size:min(${grow(H5_CONTENT_PX.revealBtn)}px, ${cap});}` +
      `.${cls} .scene.sparse .narration{font-size:min(${grow(H5_CONTENT_PX.narration)}px, ${cap});}`,
    )

    // ⑥ 标题形态
    const title = t.titleStyle === 'centerRule'
      ? `.${cls} .scene-title{justify-content:center;text-align:center;}\n.${cls} .scene-title::after{content:"";display:block;width:34%;height:2px;margin:8px auto 0;background:color-mix(in srgb, ${accent} 45%, transparent);}`
      : t.titleStyle === 'underline'
        ? `.${cls} .scene-title{text-align:left;border-bottom:2px solid color-mix(in srgb, ${accent} 45%, transparent);padding-bottom:7px;}`
        : t.titleStyle === 'block'
          ? `.${cls} .scene-title::before{content:"";display:inline-block;width:8px;height:22px;margin-right:9px;background:${accent};border-radius:2px;vertical-align:-3px;}`
          : ''
    if (title) rules.push(title)
  }
  return rules.join('\n')
}

// 母题库与选材规则已抽到共享模块（H5 / PPT 共用；含"风格禁用 + 学科相关性"过滤）：
//   见 ../visualAsset/motifPools.ts
// 旧的本地通池（含 🚦🚲🏫 等城市元素）已废弃——它会把交通灯塞进《观潮》这类课件。

/** 解析最终形态：styleDNA.morph 优先 > 主题(H5皮肤)默认 > CwTheme 风格 id 前缀映射 > storybook */
function resolveStoryMorph(colorRoot: unknown, themeId?: string): StyleMorph {
  let base = THEME_MORPH[themeId || ''] || null
  if (!base) {
    const key = styleKeyFromThemeId(themeId)
    base = key ? styleSpec(key).morph : THEME_MORPH.storybook
  }
  const sd = parseStyleDNA(colorRoot)
  if (!sd?.morph) return base
  return { ...base, ...sd.morph }
}

/** 装饰槽位：预设位置 + 基准字号 + 动画延迟（确定性，保证同一课件每次渲染一致） */
const DECOR_SLOTS = [
  { pos: 'top:14px;left:18px',     base: 46, d: 0 },
  { pos: 'top:54px;right:24px',    base: 38, d: 1.4 },
  { pos: 'top:16px;right:30px',    base: 60, d: 0.6 },
  { pos: 'top:120px;left:30px',    base: 26, d: 2.2 },
  { pos: 'top:200px;right:42px',   base: 24, d: 1.1 },
  { pos: 'bottom:18px;left:22px',  base: 40, d: 3.0 },
  { pos: 'bottom:60px;right:26px', base: 34, d: 1.8 },
  { pos: 'top:160px;left:48px',    base: 22, d: 2.6 },
  { pos: 'bottom:14px;right:18px', base: 30, d: 0.9 },
  { pos: 'bottom:90px;left:36px',  base: 28, d: 2.0 },
  { pos: 'top:90px;right:16px',    base: 32, d: 1.6 },
  { pos: 'top:250px;left:20px',    base: 20, d: 2.8 },
]

/**
 * 装饰层：从资产库取该风格的装饰资产，按 count / scale / opacity 渲染。
 *
 * 参数优先级：用户覆盖（story.decor）> 风格默认（defaultsByStyle）> 全局默认。
 * story.decor 即用户修改指令（如"云朵太多了"）结构化后的结果——
 * 因此改装饰密度只需改 decor，无需动渲染代码，这正是命中率校准的落点。
 */
function renderDeco(story: Story): string {
  // 取资产按「风格大类」而非 themeId：资产库的 styleAffinity 存的是风格/皮肤 id，
  // 直接传 CwTheme id（te-quantum-blue 等）会永远匹配不上 → 资产库形同虚设。
  const styleKey = styleKeyFromThemeId(story.themeId)
  const styleId = styleKey || (story.themeId || 'storybook')
  const refs = new Map((story.decor || []).map((r) => [r.assetId, r]))

  // 逐资产展开实例：count 决定数量，scale / opacity 决定观感
  const items: { glyph: string; scale: number; opacity: number }[] = []
  for (const asset of getAssetsByStyle(styleId)) {
    const p = resolveAssetParams(asset, styleId, refs.get(asset.id))
    const count = Math.round(Number(p.count ?? 0))
    if (count <= 0) continue
    const scale = Number(p.scale ?? 1)
    const opacity = Number(p.opacity ?? 0.4)
    for (let i = 0; i < count; i++) items.push({ glyph: asset.glyph, scale, opacity })
  }
  // 装饰资产为空时按「形态母题」兜底出装饰池，避免风格页全裸（morph 生效点 1）
  if (!items.length) {
    const morph = resolveStoryMorph(story.colorRoot, story.themeId)
    // 母题 × 风格禁用 × 学科相关性（共享规则，PPT 端同源，见 visualAsset/motifPools）
    for (const g of pickDecoGlyphs(morph.motif, styleKey, story.subject)) {
      items.push({ glyph: g, scale: 1, opacity: 0.42 })
    }
  }

  return items.map((it, i) => {
    const sl = DECOR_SLOTS[i % DECOR_SLOTS.length]
    // 实例数超出槽位时做确定性偏移，避免完全重叠
    const off = Math.floor(i / DECOR_SLOTS.length) * 12
    const shift = off ? `margin:${off}px 0 0 ${off}px;` : ''
    return `<span class="deco" style="font-size:${Math.round(sl.base * it.scale)}px;opacity:${it.opacity};${sl.pos};${shift}animation-delay:${sl.d}s">${it.glyph}</span>`
  }).join('')
}

/* ────────────────────────────────────────────────
 * 自然科学互动组件（v2）HTML 骨架
 * 行为（天气切换/雷电放电/循环推进）与音效（WebAudio 合成）在 RUNTIME_JS 内实现；
 * 状态归类（label → 晴/云/雨/雷…）也由运行时按关键词完成，渲染端零状态。
 * ──────────────────────────────────────────────── */

/** weather：`<!-- weather: 晴,多云,雷阵雨 -->` → 切换卡 */
function renderWeather(it: StoryInteraction): string {
  const states = it.states && it.states.length ? it.states : ['晴', '多云', '雷阵雨']
  return `<div class="interact sci-zone weather-zone">
  <div class="w-stage">
    <div class="w-particles"></div>
    <div class="w-bolt">⚡</div>
    <div class="w-emoji">${esc(states[0])}</div>
    <div class="w-name">${esc(states[0])}</div>
  </div>
  <div class="w-hint">☝️ 点下面按钮，看看天气怎么变</div>
  <div class="w-btns">${states.map((s, i) => `<button class="w-btn" data-i="${i}">${esc(s)}</button>`).join('')}</div>
</div>`
}

/** storm：`<!-- storm: 雷电是怎么形成的？-->` → 点云朵放电 */
function renderStorm(it: StoryInteraction): string {
  return `<div class="interact sci-zone storm-zone">
  <div class="storm-sky" title="点击云朵">
    <button class="storm-cloud" type="button">☁️</button>
    <div class="storm-charge"></div>
    <svg class="storm-bolt" viewBox="0 0 120 190" aria-hidden="true"><polyline points="62,4 32,84 54,84 24,186" fill="none" stroke="#FFE27A" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/></svg>
    <div class="storm-flash"></div>
    <div class="storm-ground">🌳🏞️🌳</div>
  </div>
  <div class="storm-caption">${esc(it.caption || '点击云朵，看看云里发生了什么')}</div>
  <div class="storm-msg"></div>
</div>`
}

/** cycle：`<!-- cycle: 水的循环：蒸发 => 凝结 => 降水 => 流回大海 -->` → 步骤推进卡 */
function renderCycle(it: StoryInteraction): string {
  const steps = it.steps || []
  if (!steps.length) return ''
  const dots = steps.map((st, i) =>
    `<i class="cy-dot" data-i="${i}" data-name="${esc(st.name)}" data-note="${esc(st.note || '')}"></i>`).join('')
  return `<div class="interact sci-zone cycle-zone">
  ${it.cycleTitle ? `<div class="cy-title">🔄 ${esc(it.cycleTitle)}</div>` : ''}
  <div class="cy-track">${dots}</div>
  <div class="cy-body">
    <div class="cy-emoji"></div>
    <div class="cy-name">${esc(steps[0].name)}</div>
    <div class="cy-note">${esc(steps[0].note || '')}</div>
  </div>
  <button class="cy-next" type="button">下一步 ▶</button>
</div>`
}

/** 单场景 → HTML 片段 */
/**
 * 装饰图 URL 净化（2026-09-17）：只放行 http(s) / data:image / 站内相对路径，并剔除引号、
 * 括号、反斜杠与空白 —— 封面素材是**教师可替换的外部输入**，一个引号就能截断 style 属性。
 */
function cssSafeUrl(u?: string): string {
  const s = String(u || '').trim()
  if (!/^(https?:|data:image\/|\/)/i.test(s)) return ''
  return s.replace(/["'()\\\s]/g, '')
}

/**
 * 封面装饰元素（2026-09-17 · 封面素材可替换）：角落 4 位 + 浮动 4 位 + 上下条带，
 * 绝对定位渲染，z-index 在内容之下（作背景层）。教师换素材即换这几处。
 */
function renderCoverDecor(d: StoryScene['decor']): string {
  if (!d) return ''
  const el = (x: { url?: string; name?: string }, cls: string) => {
    const u = cssSafeUrl(x && x.url)
    return u ? `<img class="${cls}" src="${u}" alt="${esc(x.name || '')}" loading="lazy">` : ''
  }
  return [
    ...(d.corners || []).slice(0, 4).map((c, i) => el(c, `cover-deco corner c${i + 1}`)),
    ...(d.floating || []).slice(0, 4).map((f, i) => el(f, `cover-deco float f${i + 1}`)),
    ...(d.header || []).slice(0, 2).map(h => el(h, 'cover-deco band top')),
    ...(d.footer || []).slice(0, 2).map(f => el(f, 'cover-deco band bottom')),
  ].join('')
}

function renderScene(s: StoryScene, index: number, story: Story): string {
  const theme = resolveStoryTheme(story.colorRoot, story.themeId)
  const decoHtml = renderDeco(story)
  const moodBg: Record<string, string> = {
    warm: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.5), transparent 40%)',
    playful: 'radial-gradient(circle at 80% 10%, rgba(255,255,255,.45), transparent 45%)',
    calm: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,.35), transparent 50%)',
    energetic: 'radial-gradient(circle at 30% 80%, rgba(255,255,255,.4), transparent 45%)',
  }
  const bg = moodBg[s.mood || 'warm'] || moodBg.warm

  const bubblesHtml = (s.bubbles || []).map((b, i) => {
    const color = roleColor(story.roles, b.role, i)
    const avatar = b.role ? b.role.slice(0, 1) : '?'
    return `
      <div class="bubble-row" data-role="${esc(b.role || '')}">
        <div class="avatar" style="background:${color}">${esc(avatar)}</div>
        <div class="bubble" style="--c:${color}">
          ${b.role ? `<div class="role-name">${esc(b.role)}</div>` : ''}
          <div class="bubble-text">${esc(b.text)}</div>
        </div>
      </div>`
  }).join('')

  let interactionHtml = ''
  const it = s.interaction
  if (it) {
    if (it.type === 'read' && it.reads && it.reads.length) {
      interactionHtml = `<div class="interact read-zone"><div class="interact-label">🔊 点读</div><div class="read-list">` +
        it.reads.map((r, i) => `<button class="read-word" data-text="${esc(r.text)}" data-hint="${esc(r.hint || '')}" data-i="${i}">${esc(r.text)}<span class="hint">${esc(r.hint || '')}</span></button>`).join('') +
        `</div></div>`
    } else if (it.type === 'readalong' && it.sentences && it.sentences.length) {
      interactionHtml = `<div class="interact readalong-zone"><div class="interact-label">🎤 跟读</div>` +
        it.sentences.map((r, i) =>
          `<div class="readalong-item" data-text="${esc(r.text)}" data-i="${i}">
             <span class="ra-text">${esc(r.text)}</span>
             <button class="ra-play" data-i="${i}">▶ 示范</button>
             <button class="ra-rec" data-i="${i}">● 录音</button>
             <span class="ra-status" data-i="${i}"></span>
           </div>`).join('') +
        `</div>`
    } else if (it.type === 'quiz' && it.quiz) {
      const q = it.quiz
      interactionHtml = `<div class="interact quiz-zone" data-correct="${q.correct}">
        <div class="interact-label">✏️ 想一想</div>
        <div class="quiz-q">${esc(q.question)}</div>
        <div class="quiz-opts">` +
        q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join('') +
        `</div><div class="quiz-feedback"></div></div>`
    } else if (it.type === 'reveal') {
      interactionHtml = `<div class="interact reveal-zone">
        <button class="reveal-btn" data-answer="${esc(it.answer || '')}">${esc(it.prompt || '点我揭晓')}</button>
        <div class="reveal-answer" style="display:none">${esc(it.answer || '')}</div></div>`
    } else if (it.type === 'draw') {
      interactionHtml = `<div class="interact draw-zone">
        <div class="interact-label">🎨 ${esc(it.drawTitle || '画一画')}</div>
        <canvas class="draw-canvas" width="520" height="220"></canvas>
        <div class="draw-tools"><button class="draw-clear">清除</button><input type="color" class="draw-color" value="#ff8a5b"></div>
        <div class="draw-hint">${esc(it.drawHint || '')}</div></div>`
    } else if (it.type === 'audio' && it.src) {
      interactionHtml = `<div class="interact"><audio controls src="${esc(it.src)}"></audio></div>`
    } else if (it.type === 'video' && it.src) {
      interactionHtml = `<div class="interact"><video controls src="${esc(it.src)}" poster="${esc(it.poster || '')}" style="max-width:100%"></video></div>`
    } else if (it.type === 'popup') {
      interactionHtml = `<div class="interact"><button class="popup-trigger" data-content="${esc(it.popupContent || '')}">${esc(it.triggerText || '了解更多')}</button></div>`
    } else if (it.type === 'weather') {
      interactionHtml = renderWeather(it)
    } else if (it.type === 'storm') {
      interactionHtml = renderStorm(it)
    } else if (it.type === 'cycle') {
      interactionHtml = renderCycle(it)
    }
  }

  // ── 场景版式骨架（2026-09-03 根因修复）──
  // 历史缺陷：所有 sceneType 共用「标题→旁白→气泡区→互动区→重点条」同一套 DOM，
  // 差异只体现在 class 名与配色/间距上 → 视觉上"每页都是同一个壳"。
  // 现在按该页的**主要教学动作**给出不同的 DOM 骨架（.sk-*）：
  //   dialog     角色气泡流为主体
  //   read       点读词卡为主体（不再塞进气泡列）
  //   quiz       题目与选项为主体（居中大按钮）
  //   draw       大画布为主体
  //   phenomenon 现象组件大区为主体（weather/storm/cycle）
  // 收敛原则（避免过度设计）：只让内容页的这 5 种主角版式骨架分明；
  // transition / focus / reveal 沿用原轻量骨架 + CSS 微调，保持页面节奏不杂乱。
  const stype = s.sceneType || 'dialog'
  // ── 封面装饰槽（2026-09-17）：封面素材教师可替换 —— 底图作**衬底**，元素位走 corners/floating ──
  // 衬底策略（定于 2026-09-17）：底图以半透明衬在「主题底色之上、内容之下」，不压课题文字。
  // 透明度必须与 PPT 的 DecorLayer 同值（PptxPreview.tsx 里 decor.background 那一层）——
  // 两处要一起改，勿单边调整。**单独开一层**：给 section 设 opacity 会把文字一起淡掉。
  const COVER_UNDERLAY_OPACITY = 0.18
  const coverBgImg = stype === 'cover' ? cssSafeUrl(s.decor?.background) : ''
  const coverUnderlayHtml = coverBgImg
    ? `<div class="cover-underlay" style="background-image:url('${coverBgImg}');opacity:${COVER_UNDERLAY_OPACITY}"></div>`
    : ''
  const coverDecorHtml = stype === 'cover' ? renderCoverDecor(s.decor) : ''
  const narr = s.narration ? `<div class="narration">${esc(s.narration)}</div>` : ''
  let body = ''
  if (stype === 'read') {
    body = narr + `<div class="sk sk-read">${interactionHtml}</div>`
  } else if (stype === 'quiz') {
    body = narr + `<div class="sk sk-quiz">${interactionHtml}</div>`
  } else if (stype === 'draw') {
    body = narr + `<div class="sk sk-draw">${interactionHtml}</div>`
  } else if (stype === 'phenomenon') {
    body = narr + `<div class="sk sk-phenomenon">${interactionHtml}</div>`
  } else if (stype === 'cover') {
    // 封面骨架（2026-09-17 · A1）：封面页没有旁白/气泡/互动，故不套内容页骨架。
    // 课题由 sceneTitleHtml 居中放大（见 .scene-cover .scene-title），这里补齐
    // PPT 封面版式的另两要素：学科/年级 + 授课教师。（元信息不再常驻页头，见 buildStoryH5）
    const metaLine = [story.subject, story.grade].filter(Boolean).join(' · ')
    body = `<div class="sk sk-cover">
      <div class="cover-sub">互动绘本课件</div>
      ${metaLine ? `<div class="cover-meta">📚 ${esc(metaLine)}</div>` : ''}
      ${story.teacherName ? `<div class="cover-teacher">授课教师 · ${esc(story.teacherName)}</div>` : ''}
    </div>`
  } else {
    // dialog（及 transition/focus/reveal 轻量版式）：气泡流 + 互动区
    body = narr + `<div class="stage">${bubblesHtml}</div>${interactionHtml}`
  }
  return `
  <section class="scene scene-${stype}" data-index="${index}" data-type="${stype}" style="background:${bg}">
    <!-- 内容壳（2026-09-15）：HD 固定舞台下，若整页内容高于舞台可用高度，缩放的只能是**内容**（卡片底色/圆角/阴影
         仍铺满舞台，视觉更像课堂投屏的一页）；没有这层壳，缩放就没有可施加的对象。 -->
    ${coverUnderlayHtml}
    <div class="scene-inner">
      ${coverDecorHtml}
      ${decoHtml}
      ${sceneTitleHtml(s.title)}
      ${body}
      ${s.focus ? `<div class="focus-bar">⭐ 重点：${esc(s.focus)}</div>` : ''}
    </div>
  </section>`
}

const RUNTIME_JS = `
(function(){
  // ---- 翻页引擎 ----
  var root = document.querySelector('.story-root');
  if(!root) return;
  var scenes = Array.prototype.slice.call(root.querySelectorAll('.scene'));
  var idx = 0, total = scenes.length;
  // 封面不计入页数（2026-09-17 · A1）：与 PPT 端同规则 —— 封面屏显示「封面」，
  // 内容屏从 1 计，总页数只数内容页。（.pg-info 每次重建 innerHTML，故下面需重新查询取用）
  var hasCover = total > 0 && scenes[0].getAttribute('data-type') === 'cover';
  var contentTotal = total - (hasCover ? 1 : 0);
  function show(i){
    idx = Math.max(0, Math.min(total-1, i));
    scenes.forEach(function(s,k){ s.classList.toggle('active', k===idx); });
    var pg = root.querySelector('.pg-info');
    if(pg){
      if(hasCover && idx === 0){ pg.innerHTML = '封面'; }
      else { pg.innerHTML = '<span class="pg-cur">'+(idx+1-(hasCover?1:0))+'</span>/<span class="pg-total">'+contentTotal+'</span>'; }
    }
    if(contentTotal > 0) root.querySelector('.progress-bar').style.width = ((idx+1-(hasCover?1:0))/contentTotal*100)+'%';
    root.querySelector('.prev').classList.toggle('disabled', idx===0);
    root.querySelector('.next').classList.toggle('disabled', idx===total-1);
    autofit(scenes[idx]);
  }
  // ---- 页内自适应（2026-09-11 · 基操）----
  // 固定画布内按「内容填充率」分档：稀疏 → 放大字号/行距填满；溢出 → 标记 dense 收紧。
  // 一次性解决"短内容→空洞"与"长内容→溢出"两端，任何风格/内容页自动生效。
  function contentH(sc){
    var h = 0;
    for (var i = 0; i < sc.children.length; i++) {
      var c = sc.children[i];
      var g = getComputedStyle(c);
      if (g.position === 'absolute' || g.display === 'none') continue;
      h += c.getBoundingClientRect().height + (parseFloat(g.marginBottom) || 0);
    }
    return h;
  }
  // 等比适配（2026-09-15）：HD 固定舞台下，若整页内容高于舞台可用高度，按 avail/need 缩放**内容壳**，
  // 保证整页可见（课堂投屏不该出现滚动条/被截断）。手机（非 HD）保持原来的自然流 + 滚动。
  function fitToStage(sc, avail, need){
    var inner = sc.querySelector('.scene-inner');
    if (!inner) return;
    inner.style.transform = ''; inner.style.width = ''; inner.style.transformOrigin = '';
    sc.classList.remove('fit');
    if (!document.body.classList.contains('hd') || need <= avail + 1) return;
    var k = Math.max(0.6, avail / need);            // 下限 0.6：再小就伤可读性，宁可留一点滚动
    inner.style.transformOrigin = 'top left';
    inner.style.transform = 'scale(' + k + ')';
    inner.style.width = 'calc(100% / ' + k + ')';   // 宽度补偿：缩放后仍满宽，避免换行变化引起反复
    sc.classList.add('fit');
  }
  function autofit(sc){
    if (!sc) return;
    // 先还原适配，再量高度 —— 否则量到的是"缩放后的高度"，会越缩越小（自激）
    var innerEl = sc.querySelector('.scene-inner');
    if (innerEl) { innerEl.style.transform = ''; innerEl.style.width = ''; innerEl.style.transformOrigin = ''; }
    sc.classList.remove('fit');
    var cs = getComputedStyle(sc);
    var pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var avail = sc.clientHeight - pad;
    if (avail <= 0) return;
    // 内容总高取两者较大：内容壳高度 vs 场景自身的可滚动高度（后者包含"子元素溢出壳"的部分，如互动组件内部）
    var need = Math.max(contentH(sc), sc.scrollHeight - pad);
    var fill = need / avail;
    sc.classList.toggle('sparse', fill < 0.62);
    sc.classList.toggle('dense', fill > 1.0);
    fitToStage(sc, avail, need);
  }
  window.addEventListener('resize', function(){ setTimeout(function(){ autofit(scenes[idx]); }, 60); });
  root.querySelector('.next').addEventListener('click', function(){ show(idx+1); });
  root.querySelector('.prev').addEventListener('click', function(){ show(idx-1); });
  root.addEventListener('wheel', function(e){
    e.preventDefault();
    if(root._lock) return;
    root._lock = true;
    if(e.deltaY > 0) show(idx+1); else show(idx-1);
    setTimeout(function(){ root._lock = false; }, 450);
  }, { passive:false });
  // 手势翻页（2026-09-11 统一为「上下」）：上下滑翻页，阈值 50px；
  // 画廊 / 画布 / 弹层 / 互动控件内的触摸不触发翻页（它们有各自的交互）。
  var sy=0;
  root.addEventListener('touchstart', function(e){ sy = e.touches[0].clientY; }, {passive:true});
  root.addEventListener('touchend', function(e){
    var t = e.target;
    if (t && t.closest && t.closest('.gallery,.draw-canvas,.popup-mask,.read-word,.quiz-opt,.w-btn,.cy-next')) return;
    var dy = e.changedTouches[0].clientY - sy;
    if(Math.abs(dy) > 50){ if(dy<0) show(idx+1); else show(idx-1); }
  }, {passive:true});
  root.addEventListener('keydown', function(e){
    if(e.key==='ArrowDown'||e.key===' '||e.key==='PageDown') show(idx+1);
    if(e.key==='ArrowUp'||e.key==='PageUp') show(idx-1);
  });
  root.tabIndex = 0;

  // ---- 点读 (Web Speech TTS) ----
  // 语言自适应（2026-09-11 修复）：此前 u.lang 硬编码 'en-US'，中文内容被英文语音朗读
  // （反馈"H5 里的音频是纯英文"的根因）。改为按文本判定 zh-CN / en-US。
  function pickLang(t){
    return /[\\u4e00-\\u9fa5]/.test(t || '') ? 'zh-CN' : 'en-US';
  }
  // 停止/关闭控件（2026-09-13 补）：此前点读**只能开始、无法暂停或关闭**
  // （反馈"没有播放器，不知道如何暂停与关闭"）。现在朗读时右下角出现「停止朗读」，
  // 再点同一个词也等于关闭，朗读结束自动收起。
  function stopSpeak(){
    try{ if('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
    var b = root.querySelector('.tts-stop');
    if(b && b.parentNode) b.parentNode.removeChild(b);
    root.querySelectorAll('.read-word').forEach(function(x){ x.classList.remove('on'); });
  }
  function showStopBtn(){
    if(root.querySelector('.tts-stop')) return;
    var b = document.createElement('button');
    b.className = 'tts-stop';
    b.textContent = '停止朗读';
    b.setAttribute('style','position:fixed;right:16px;bottom:16px;z-index:9999;padding:9px 16px;'
      + 'border-radius:999px;border:0;background:rgba(17,17,17,.78);color:#fff;font-size:13px;'
      + 'line-height:1;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25)');
    b.addEventListener('click', function(){ stopSpeak(); });
    root.appendChild(b);
  }
  function tts(text){
    try{
      if('speechSynthesis' in window){
        var u = new SpeechSynthesisUtterance(text);
        var lang = pickLang(text);
        u.lang = lang; u.rate = 0.9;
        // 只设 lang 不够：系统若无对应音色，浏览器会回落默认音色（常见为英文）
        // —— 这正是"设了 zh-CN 仍读英文"的常见原因，故显式挑一个匹配音色。
        try{
          var vs = speechSynthesis.getVoices() || [];
          var base = lang.split('-')[0].toLowerCase();
          for(var i=0;i<vs.length;i++){
            if((vs[i].lang||'').toLowerCase().indexOf(base) === 0){ u.voice = vs[i]; u.lang = vs[i].lang; break; }
          }
        }catch(e){}
        u.onend = function(){ stopSpeak(); };
        u.onerror = function(){ stopSpeak(); };
        speechSynthesis.cancel(); speechSynthesis.speak(u);
        showStopBtn();
      }
    }catch(e){}
  }
  root.querySelectorAll('.read-word').forEach(function(b){
    b.addEventListener('click', function(){
      if(b.classList.contains('on')){ stopSpeak(); return; }   // 再点一次 = 关闭朗读
      root.querySelectorAll('.read-word').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on'); tts(b.getAttribute('data-text'));
    });
  });

  // ---- 跟读 (录音回放) ----
  var mediaRecorder=null, chunks=[];
  root.querySelectorAll('.readalong-item').forEach(function(item){
    var i = item.getAttribute('data-i');
    var text = item.getAttribute('data-text');
    var status = item.querySelector('.ra-status');
    // 跟读的「示范」同样可关闭（2026-09-13）：再点一次＝停止，避免"点了关不掉"
    var _raPlay = item.querySelector('.ra-play');
    if(_raPlay){
      _raPlay.addEventListener('click', function(){
        if(_raPlay.classList.contains('on')){ stopSpeak(); _raPlay.classList.remove('on'); _raPlay.textContent = '▶ 示范'; return; }
        root.querySelectorAll('.ra-play').forEach(function(x){ x.classList.remove('on'); x.textContent = '▶ 示范'; });
        _raPlay.classList.add('on'); _raPlay.textContent = '⏹ 停止';
        tts(text);
      });
    }
    var recBtn = item.querySelector('.ra-rec');
    recBtn.addEventListener('click', function(){
      if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ status.textContent='设备不支持'; return; }
      if(mediaRecorder && mediaRecorder.state==='recording'){
        mediaRecorder.stop(); recBtn.textContent='● 录音'; return;
      }
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        mediaRecorder = new MediaRecorder(stream); chunks=[];
        mediaRecorder.ondataavailable = function(e){ chunks.push(e.data); };
        mediaRecorder.onstop = function(){
          var blob = new Blob(chunks, {type:'audio/webm'});
          var url = URL.createObjectURL(blob);
          status.innerHTML = '<a href="'+url+'" download="readalong'+i+'.webm">▶ 回放我的跟读</a>';
          stream.getTracks().forEach(function(t){ t.stop(); });
        };
        mediaRecorder.start(); recBtn.textContent='■ 停止';
      }).catch(function(){ status.textContent='需麦克风权限'; });
    });
  });

  // ---- 选择题 ----
  root.querySelectorAll('.quiz-zone').forEach(function(z){
    var correct = parseInt(z.getAttribute('data-correct'),10);
    var fb = z.querySelector('.quiz-feedback');
    z.querySelectorAll('.quiz-opt').forEach(function(o){
      o.addEventListener('click', function(){
        z.querySelectorAll('.quiz-opt').forEach(function(x){ x.classList.remove('right','wrong'); });
        var i = parseInt(o.getAttribute('data-i'),10);
        if(i===correct){ o.classList.add('right'); fb.textContent='✅ 正确！'; fb.className='quiz-feedback ok'; }
        else { o.classList.add('wrong'); fb.textContent='❌ 再想想~'; fb.className='quiz-feedback no'; }
      });
    });
  });

  // ---- 揭示 ----
  root.querySelectorAll('.reveal-btn').forEach(function(b){
    b.addEventListener('click', function(){
      b.style.display='none';
      var a = b.parentNode.querySelector('.reveal-answer');
      a.style.display='block'; tts(a.textContent);
    });
  });

  // ---- 绘图 ----
  root.querySelectorAll('.draw-canvas').forEach(function(cv){
    var ctx = cv.getContext('2d'); var drawing=false; var color='#ff8a5b';
    cv.parentNode.querySelector('.draw-color').addEventListener('input', function(e){ color=e.target.value; });
    function pos(e){ var r=cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height)}; }
    cv.addEventListener('mousedown', function(e){ drawing=true; var p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); });
    cv.addEventListener('mousemove', function(e){ if(!drawing) return; var p=pos(e); ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineTo(p.x,p.y); ctx.stroke(); });
    window.addEventListener('mouseup', function(){ drawing=false; });
    cv.addEventListener('touchstart', function(e){ drawing=true; var p=pos(e.touches[0]); ctx.beginPath(); ctx.moveTo(p.x,p.y); });
    cv.addEventListener('touchmove', function(e){ if(!drawing) return; var p=pos(e.touches[0]); ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineTo(p.x,p.y); ctx.stroke(); });
    cv.addEventListener('touchend', function(){ drawing=false; });
    cv.parentNode.querySelector('.draw-clear').addEventListener('click', function(){ ctx.clearRect(0,0,cv.width,cv.height); });
  });

  // ---- 弹层 ----
  root.querySelectorAll('.popup-trigger').forEach(function(b){
    b.addEventListener('click', function(){
      var d = document.createElement('div'); d.className='popup-mask';
      d.innerHTML = '<div class="popup-box"><div class="popup-close">×</div><div>'+b.getAttribute('data-content')+'</div></div>';
      d.addEventListener('click', function(e){ if(e.target===d || e.target.className==='popup-close') d.remove(); });
      document.body.appendChild(d);
    });
  });

  // ============================================================
  // 自然科学互动组件 v2（2026-09-03）：weather / storm / cycle
  // ============================================================
  // WebAudio 合成音效（零素材零版权）：雷声=低频噪声+50Hz 轰鸣；雨声=白噪+高通滤波。
  var __AC = null, __noise = null;
  function ac(){
    if(!__AC){ try{ __AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ __AC = null; } }
    try{ if(__AC && __AC.state === 'suspended'){ __AC.resume(); } }catch(e){}
    return __AC;
  }
  function stopNoise(){
    try{ if(__noise){ __noise.stop(); __noise = null; } }catch(e){ __noise = null; }
  }
  function playNoise(kind){
    var a = ac(); if(!a) return;
    stopNoise();
    var ctx = a, dur = kind === 'thunder' ? 1.8 : 3.0;
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    var ch = buf.getChannelData(0);
    for(var bi = 0; bi < ch.length; bi++){ ch[bi] = Math.random() * 2 - 1; }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = kind !== 'thunder';
    var f = ctx.createBiquadFilter();
    f.type = kind === 'thunder' ? 'lowpass' : 'highpass';
    f.frequency.value = kind === 'thunder' ? 110 : 3400;
    f.Q.value = 0.6;
    var g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    if(kind === 'thunder'){
      var gd = g.gain, t = ctx.currentTime;
      gd.setValueAtTime(0.0001, t);
      gd.linearRampToValueAtTime(0.55, t + 0.03);
      gd.exponentialRampToValueAtTime(0.12, t + 0.4);
      gd.linearRampToValueAtTime(0.32, t + 0.65);
      gd.exponentialRampToValueAtTime(0.0001, t + 1.7);
      var osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 50;
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.linearRampToValueAtTime(0.4, t + 0.05);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      osc.connect(og); og.connect(ctx.destination);
      osc.start(t); osc.stop(t + 2);
    } else {
      g.gain.value = kind === 'rain' ? 0.055 : 0.02;
    }
    src.start();
    __noise = src;
    if(kind === 'thunder'){ setTimeout(function(){ stopNoise(); }, 1800); }
  }
  // weather：状态标签按关键词归类成 晴/云/阴/雨/雷/雪/风（优先级自上而下）
  var WEATHER_KINDS = [
    { re: /雷/, cls: 'wk-thunder', emoji: '⛈️', sfx: 'thunder', pt: 'rain' },
    { re: /雪/, cls: 'wk-snow', emoji: '❄️', sfx: null, pt: 'snow' },
    { re: /多云/, cls: 'wk-cloudy', emoji: '⛅', sfx: null, pt: null },
    { re: /雨/, cls: 'wk-rain', emoji: '🌧️', sfx: 'rain', pt: 'rain' },
    { re: /晴/, cls: 'wk-sun', emoji: '☀️', sfx: null, pt: null },
    { re: /风/, cls: 'wk-wind', emoji: '🌬️', sfx: null, pt: 'wind' },
    { re: /阴/, cls: 'wk-overcast', emoji: '☁️', sfx: null, pt: null },
    { re: /.*/, cls: 'wk-cloudy', emoji: '⛅', sfx: null, pt: null }
  ];
  function weatherKind(label){
    for(var wi = 0; wi < WEATHER_KINDS.length; wi++){ if(WEATHER_KINDS[wi].re.test(label)) return WEATHER_KINDS[wi]; }
    return WEATHER_KINDS[WEATHER_KINDS.length - 1];
  }
  function spawnParticles(zone, kind){
    var box = zone.querySelector('.w-particles'); if(!box) return;
    box.innerHTML = '';
    if(!kind) return;
    var n = kind === 'rain' ? 14 : (kind === 'snow' ? 12 : 8);
    for(var pi = 0; pi < n; pi++){
      var p = document.createElement('span');
      p.className = 'particle ' + kind;
      p.style.left = (Math.random() * 94 + 3) + '%';
      if(kind === 'snow'){ p.textContent = '❄️'; }
      else if(kind === 'wind'){ p.textContent = '🍃'; }
      var spd = kind === 'rain' ? (0.7 + Math.random() * 0.7) : (2.2 + Math.random() * 2.6);
      p.style.animationDuration = spd + 's';
      p.style.animationDelay = (Math.random() * spd) + 's';
      p.style.fontSize = kind === 'rain' ? '9px' : '17px';
      box.appendChild(p);
    }
  }
  function setWeather(zone, idx, label, silent){
    var k = weatherKind(label);
    var stage = zone.querySelector('.w-stage');
    stage.className = 'w-stage ' + k.cls;
    zone.querySelector('.w-emoji').textContent = k.emoji;
    zone.querySelector('.w-name').textContent = label;
    zone.querySelectorAll('.w-btn').forEach(function(b, j){ b.classList.toggle('on', j === idx); });
    if(silent) return;   // 首次初始化为静默态：避免未交互先出声、多页雨声叠加
    stopNoise();
    spawnParticles(zone, k.pt);
    if(k.sfx === 'thunder'){
      var bolt = zone.querySelector('.w-bolt');
      bolt.classList.remove('on'); void bolt.offsetWidth; bolt.classList.add('on');
      setTimeout(function(){ bolt.classList.remove('on'); }, 1100);
      playNoise('thunder');
    } else if(k.sfx === 'rain'){ playNoise('rain'); }
  }
  root.querySelectorAll('.weather-zone').forEach(function(zone){
    var labels = [];
    zone.querySelectorAll('.w-btn').forEach(function(b){ labels.push(b.textContent); });
    zone.querySelectorAll('.w-btn').forEach(function(b, i){
      b.addEventListener('click', function(){ setWeather(zone, i, labels[i], false); });
    });
    if(labels.length){ setWeather(zone, 0, labels[0], true); }
  });

  // storm：点云朵 → 电荷聚集 → 闪电+雷声 → 说明（可重复演示）
  root.querySelectorAll('.storm-zone').forEach(function(zone){
    var cloud = zone.querySelector('.storm-cloud'), busy = false;
    var bolt = zone.querySelector('.storm-bolt'), flash = zone.querySelector('.storm-flash');
    var chg = zone.querySelector('.storm-charge'), msg = zone.querySelector('.storm-msg');
    cloud.addEventListener('click', function(){
      if(busy) return; busy = true;
      chg.innerHTML = '<span class="chg-p">+</span><span class="chg-n">−</span><span class="chg-p">+</span><span class="chg-n">−</span>';
      cloud.classList.remove('on'); void cloud.offsetWidth; cloud.classList.add('on');
      msg.textContent = '云里的电荷悄悄聚拢……';
      setTimeout(function(){
        bolt.classList.remove('on'); flash.classList.remove('on');
        void bolt.offsetWidth;
        bolt.classList.add('on'); flash.classList.add('on');
        playNoise('thunder');
        msg.textContent = '⚡ 咔嚓——放电啦！';
        setTimeout(function(){
          bolt.classList.remove('on'); flash.classList.remove('on');
          chg.innerHTML = '';
          msg.textContent = '打雷就是云里的电荷在放电，你听，轰隆隆～';
          busy = false;
        }, 1300);
      }, 1100);
    });
  });

  // cycle：点"下一步"逐步推进；点圆点可跳步（水循环/四季/月相/昼夜/植物生长）
  function stepEmoji(name){
    var map = [
      { re: /蒸发/, e: '💨' }, { re: /凝结|云雾|成云|变成云/, e: '☁️' },
      { re: /下雪|降雪/, e: '❄️' }, { re: /降水|下雨|降雨|落雨/, e: '🌧️' },
      { re: /径流|流回|汇入|流动/, e: '🌊' }, { re: /渗透|下渗/, e: '🕳️' },
      { re: /融化/, e: '💧' }, { re: /结冰|冻结/, e: '🧊' },
      { re: /月亮|月相|月牙|满月|新月|望月|朔/, e: '🌙' },
      { re: /白天|清晨|日出/, e: '☀️' }, { re: /夜晚|黑夜|黄昏|日落/, e: '🌃' },
      { re: /春天/, e: '🌱' }, { re: /夏天/, e: '🌻' }, { re: /秋天/, e: '🍂' }, { re: /冬天/, e: '⛄' },
      { re: /种子|发芽|生根/, e: '🌱' }, { re: /生长|长高/, e: '🌿' },
      { re: /开花/, e: '🌸' }, { re: /结果/, e: '🍎' },
      { re: /太阳|日照/, e: '☀️' }, { re: /云/, e: '☁️' },
      { re: /闪电|放电/, e: '⚡' }, { re: /风|飘/, e: '💨' },
      { re: /水汽|上升/, e: '💨' }
    ];
    for(var mi = 0; mi < map.length; mi++){ if(map[mi].re.test(name)) return map[mi].e; }
    return '🔄';
  }
  root.querySelectorAll('.cycle-zone').forEach(function(zone){
    var dots = zone.querySelectorAll('.cy-dot');
    var emojiEl = zone.querySelector('.cy-emoji');
    var nameEl = zone.querySelector('.cy-name');
    var noteEl = zone.querySelector('.cy-note');
    var next = zone.querySelector('.cy-next');
    var names = [], notes = [];
    dots.forEach(function(dot){ names.push(dot.getAttribute('data-name') || ''); notes.push(dot.getAttribute('data-note') || ''); });
    if(!names.length){ return; }
    function showCycle(i, replay){
      var step = Math.max(0, Math.min(names.length - 1, i));
      dots.forEach(function(dot, j){
        dot.classList.toggle('cur', j === step);
        dot.classList.toggle('done', j < step);
      });
      if(replay){
        var b = zone.querySelector('.cy-body');
        b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
      }
      emojiEl.textContent = stepEmoji(names[step]);
      nameEl.textContent = names[step];
      noteEl.textContent = notes[step] || '';
      next.textContent = step >= names.length - 1 ? '再看一遍 ↺' : '下一步 ▶';
    }
    var at = 0;
    next.addEventListener('click', function(){
      at = at >= names.length - 1 ? 0 : at + 1;
      showCycle(at, true);
    });
    dots.forEach(function(dot, j){
      dot.addEventListener('click', function(){ at = j; showCycle(at, true); });
    });
    showCycle(0, false);
  });

  // ── HD 舞台开关（2026-09-15）──
  // 大屏（电视/电子白板）用固定 16:9 舞台并等比缩放铺满，课堂投屏不再"忽高忽低"。
  function syncHd(){
    var q = null;
    try { q = new URLSearchParams(location.search).get('hd'); } catch(e){}
    var on = window.innerWidth >= 1024 && window.innerHeight >= 576;
    if (q === '1') on = true; else if (q === '0') on = false;
    if (typeof window.__hdForced === 'boolean') on = window.__hdForced;
    if (on) {
      var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
      root.style.setProperty('--hd-s', String(s));
    }
    document.body.classList.toggle('hd', on);
    setTimeout(function(){ autofit(scenes[idx]); }, 40);
  }
  window.addEventListener('message', function(e){
    var d = e && e.data;
    if (d && d.type === 'cw-h5-hd') { window.__hdForced = !!d.on; syncHd(); }
  });
  window.addEventListener('resize', function(){ syncHd(); });
  syncHd();

  show(0);
})();
`

/* ── HD 舞台样式（2026-09-15）：电视 / 电子白板等大屏课堂投屏 ──
   问题：此前页面高度由内容撑开（.scene 的 min-height:min(480px,72vh)），同一份课件在不同屏幕上高度不一 ——
   投到课堂大屏"忽高忽低"，且与编辑器画布看到的比例不一致。
   做法：HD 下把整份绘本放进固定 1280×720（16:9）逻辑舞台，再按视口等比缩放铺满；内容超出舞台时在场景内滚动。
   手机（<1024px）保持原来的自适应阅读体验。
   触发：① 视口自动判定（宽≥1024 且 高≥576）② URL 问号参数 hd=1/0 ③ 父窗口 postMessage
        （编辑器画布窗格通常 <1024，但要让教师看到与课堂投屏**同一比例**，由父级显式开启）。
   注意：必须注入在结构 CSS **之后** —— 结构 CSS 也写了 .story-root 的尺寸，同特异性下后者胜出
        （实测：放在 RUNTIME_CSS 里会被盖掉，舞台按内容走、比例不是 16:9）。 */
const HD_STAGE_CSS = `
body.hd{display:flex;align-items:center;justify-content:center;padding:0 !important;overflow:hidden;min-height:100vh;}
body.hd .story-root{flex:none;width:1280px !important;height:720px !important;max-width:none;min-height:0;margin:0;box-sizing:border-box;
  padding:18px 26px 14px;display:flex;flex-direction:column;
  transform:scale(var(--hd-s,1));transform-origin:center center;}
body.hd .story-header{flex:0 0 auto;}
body.hd .scene{min-height:0;height:auto;flex:1 1 auto;overflow:auto;}
body.hd .scene.active{justify-content:center;}
body.hd .scene.active.dense{justify-content:flex-start;}
/* 内容高于舞台 → 等比缩到整页可见（课堂投屏不该出现滚动/截断）；卡片底色/圆角仍铺满舞台 */
body.hd .scene.fit{justify-content:flex-start;overflow:hidden;}
body.hd .scene.fit .scene-inner{justify-content:flex-start;}
body.hd .progress{flex:0 0 auto;margin-top:8px;}
body.hd .nav-bar{position:absolute;right:12px;top:50%;transform:translateY(-50%);flex-direction:column;gap:12px;margin:0;z-index:40;}
body.hd .nav-bar button{width:44px;height:44px;font-size:20px;}
`

const RUNTIME_CSS = `
.story-root{position:relative;z-index:1;width:100%;max-width:960px;margin:0 auto;min-height:560px;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--text,#3A2E2E);outline:none;overscroll-behavior:contain;}
:root{--bg1:#FFE8C9;--bg2:#FFD6E0;--card:#FFFDF8;--accent:#FF8A5B;--accent2:#FFB454;--text:#3A2E2E;--ink:#5A4A4A;}
.scene{display:none;padding:36px 32px 84px;border-radius:28px;box-shadow:0 18px 50px rgba(0,0,0,.16);min-height:min(480px,72vh);animation:fade .45s ease;overflow:hidden;position:relative;background:var(--card);}   /* 左右 32 = 法则阶梯（xxl）；下 84 保留固定导航避让 */
/* 留白自适应（2026-09-11）：内容量少时**垂直居中**，空白四周均衡，避免"顶对齐 + 底部空洞"；
   内容多时自然撑满。min-height 用 min(480px,72vh) 随视口收缩，小屏不浪费。 */
.scene.active{display:flex;flex-direction:column;justify-content:center;}
/* 场景内容壳：等价于原来"场景直接当列 flex 容器"的排版（居中），多一层是为了能在 HD 下单独缩放内容。
   注意 flex 用 0 0 auto：壳的高度必须等于**内容高度**（若 flex:1 会被拉伸到舞台高，"量内容"就量不到了）。 */
.scene-inner{display:flex;flex-direction:column;flex:0 0 auto;min-height:0;min-width:0;width:100%;justify-content:center;}
@keyframes fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.deco{position:absolute;pointer-events:none;z-index:0;opacity:.92;filter:drop-shadow(0 6px 10px rgba(0,0,0,.08));animation:decoFloat var(--deco-dur,6s) ease-in-out infinite;}
@keyframes decoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.scene-title{position:relative;z-index:2;font-size:26px;font-weight:900;color:var(--accent);margin-bottom:14px;letter-spacing:1px;display:flex;align-items:center;gap:8px;}
.scene-title::before{content:"🌟";font-size:22px;}
/* ── 场景版式类型视觉区分（2026-09-03 v1，受控集合 7 类）── */
.scene-dialog .scene-title::before{content:"💬";}
.scene-read .scene-title::before{content:"🔤";}
.scene-quiz .scene-title::before{content:"✅";}
.scene-reveal .scene-title::before{content:"🔍";}
.scene-draw .scene-title::before{content:"🎨";}
.scene-focus .scene-title::before{content:"⭐";}
.scene-transition .scene-title::before{content:"✨";}
.scene-phenomenon .scene-title::before{content:"🔬";}
/* read：点读词块放大居中（窄屏自动换行） */
.scene-read .interact{margin-top:${H5LAW.blockGap}px;padding:${H5LAW.panelPadY}px ${H5LAW.panelPadX}px;}
.scene-read .read-list{gap:${H5LAW.itemGap}px;justify-content:center;}
.scene-read .read-word{font-size:24px;padding:12px 32px;border-radius:32px;}
.scene-read .read-word .hint{font-size:13px;}
/* quiz：选项卡大按钮（适合点选） */
.scene-quiz .quiz-opts{gap:${H5LAW.itemGap}px;}
.scene-quiz .quiz-opt{font-size:18px;padding:16px 24px;}
/* reveal：揭晓大按钮居中 */
.scene-reveal .interact{display:flex;flex-direction:column;align-items:center;text-align:center;}
.scene-reveal .reveal-btn{font-size:18px;padding:12px 32px;border-radius:28px;}
.scene-reveal .reveal-answer{font-size:17px;}
/* draw：绘图画布加高，现场边讲边画更宽敞 */
.scene-draw .interact{padding:${H5LAW.itemGap}px;}
.scene-draw .draw-canvas{height:270px;}
/* focus：重点大字条强化（关键字收束页） */
.scene-focus .focus-bar{font-size:19px;padding:16px 24px;margin-top:24px;}
/* transition：转场/封面/收束——低信息密度，旁白居中，隐藏对话与互动 */
.scene-transition{padding:56px 34px 92px;}
.scene-transition .narration{font-size:21px;line-height:2;text-align:center;background:rgba(255,255,255,.55);}
.scene-transition .stage,.scene-transition .interact{display:none;}
/* phenomenon（v2）：现象演示页——weather/storm/cycle 组件独占主体，去掉卡片化 interact 外壳 */
.scene-phenomenon .stage{display:none;}
.scene-phenomenon .narration{text-align:center;font-size:16px;border-style:solid;}
.scene-phenomenon .interact{background:transparent;border:0;padding:0;margin-top:${H5LAW.blockGap}px;box-shadow:none;}
/* ── 自然科学组件 v2（weather / storm / cycle）样式 ── */
/* weather：天空舞台 + 粒子 + 闪电 */
.w-stage{position:relative;height:200px;border-radius:20px;overflow:hidden;border:2px solid rgba(0,0,0,.06);
  display:flex;align-items:center;justify-content:center;transition:background 1s ease;}
.wk-sun{background:linear-gradient(180deg,#8ed0f7,#d8f3ff 62%,#fff6d8);}
.wk-cloudy{background:linear-gradient(180deg,#bcd6e8,#edf3f8);}
.wk-overcast{background:linear-gradient(180deg,#a9b4bf,#d7dde2);}
.wk-rain{background:linear-gradient(180deg,#8fb6d8,#c9ddec);}
.wk-thunder{background:linear-gradient(180deg,#4f5f7a,#8fa3bc);}
.wk-snow{background:linear-gradient(180deg,#d9e9f5,#f6fafd);}
.wk-wind{background:linear-gradient(180deg,#bde0c0,#ecf7ec);}
.w-emoji{font-size:70px;line-height:1;z-index:2;filter:drop-shadow(0 8px 14px rgba(0,0,0,.14));animation:wBob 3s ease-in-out infinite;}
@keyframes wBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.w-name{position:absolute;right:14px;bottom:10px;color:#fff;font-weight:900;font-size:17px;z-index:3;text-shadow:0 2px 8px rgba(0,0,0,.4);}
.w-hint{margin-top:8px;text-align:center;font-size:12px;color:var(--ink);}
.w-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px;}
.w-btn{border:2px solid var(--accent2);background:#fff;border-radius:24px;padding:7px 16px;cursor:pointer;font-weight:700;color:var(--text);transition:.18s;}
.w-btn:hover{transform:translateY(-2px);}
.w-btn.on{background:var(--accent);border-color:var(--accent);color:#fff;}
.w-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;}
.particle{position:absolute;top:-30px;opacity:0;animation-name:wFall;animation-timing-function:linear;animation-iteration-count:infinite;pointer-events:none;}
.particle.rain{width:2px;height:16px;border-radius:2px;background:rgba(150,200,240,.85);}
.particle.snow,.particle.wind{line-height:1;background:none;width:auto;height:auto;}
.particle.wind{animation-name:wBlow;}
@keyframes wFall{0%{opacity:0;transform:translateY(0)}8%{opacity:.95}90%{opacity:.75}100%{opacity:0;transform:translateY(240px)}}
@keyframes wBlow{0%{opacity:0;transform:translate(10px,0)}15%{opacity:.9}100%{opacity:0;transform:translate(-70px,190px)}}
.w-bolt{position:absolute;top:20%;left:50%;transform:translateX(-50%);font-size:64px;opacity:0;z-index:2;pointer-events:none;}
.w-bolt.on{animation:wBoltFlash .95s steps(1) 1;}
@keyframes wBoltFlash{0%{opacity:0}10%{opacity:1}28%{opacity:.1}44%{opacity:1}60%{opacity:.3}78%{opacity:1}100%{opacity:0}}
/* storm：点云放电 */
.storm-sky{position:relative;height:210px;border-radius:20px;overflow:hidden;cursor:pointer;
  background:linear-gradient(180deg,#42557a,#8aa3bd 50%,#c9d9c2 88%,#8aa97f);
  border:2px solid rgba(0,0,0,.05);user-select:none;-webkit-user-select:none;}
.storm-cloud{position:absolute;top:4%;left:50%;transform:translateX(-50%);border:none;background:none;cursor:pointer;
  font-size:92px;line-height:1;z-index:3;text-shadow:0 12px 26px rgba(0,0,0,.28);transition:filter .3s,transform .3s;}
.storm-cloud:hover{transform:translateX(-50%) scale(1.07);}
.storm-cloud.on{filter:brightness(.7);animation:cloudShake .5s;}
@keyframes cloudShake{0%,100%{transform:translateX(-50%)}25%{transform:translateX(-56%)}75%{transform:translateX(-44%)}}
.storm-charge{position:absolute;top:46%;left:0;right:0;display:flex;justify-content:space-around;z-index:2;pointer-events:none;font-weight:900;font-size:30px;}
.storm-charge .chg-p{color:#FFD166;opacity:0;animation:chargeIn .5s ease forwards;}
.storm-charge .chg-n{color:#9db9ff;opacity:0;animation:chargeIn .5s ease .25s forwards;}
@keyframes chargeIn{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
.storm-bolt{position:absolute;top:26%;left:50%;transform:translateX(-50%);width:110px;height:150px;opacity:0;z-index:4;pointer-events:none;filter:drop-shadow(0 0 14px #ffe27a);}
.storm-bolt.on{animation:boltFlash .95s steps(1) 1;}
@keyframes boltFlash{0%{opacity:0}12%{opacity:1}26%{opacity:.15}40%{opacity:1}54%{opacity:.35}72%{opacity:1}100%{opacity:0}}
.storm-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5;}
.storm-flash.on{animation:screenFlash .95s ease 1;}
@keyframes screenFlash{0%{opacity:0}10%{opacity:.8}26%{opacity:0}40%{opacity:.45}58%{opacity:0}100%{opacity:0}}
.storm-ground{position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:30px;opacity:.95;letter-spacing:6px;z-index:1;}
.storm-caption{margin-top:10px;font-weight:800;color:var(--accent);font-size:14px;background:rgba(255,255,255,.8);border-radius:12px;padding:9px 14px;border:2px dashed rgba(0,0,0,.06);}
.storm-msg{margin-top:8px;min-height:22px;font-weight:800;color:var(--ink);text-align:center;font-size:14px;}
/* cycle：现象循环推进 */
.cycle-zone{background:rgba(255,255,255,.72);border:2px solid rgba(0,0,0,.05);padding:16px 16px;border-radius:18px;}
.cy-title{font-weight:900;font-size:18px;color:var(--accent);text-align:center;margin-bottom:4px;}
.cy-track{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0 12px;flex-wrap:wrap;}
.cy-dot{position:relative;width:15px;height:15px;border-radius:50%;background:#e3e3e3;border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.07);cursor:pointer;transition:.2s;}
/* 圆点视觉只有 15px（设计如此），但**有效触控区**必须 ≥44×44（R3）：用透明伪元素补足，不改观感 */
.cy-dot::after{content:"";position:absolute;left:50%;top:50%;width:${TEXT.minTouchPx}px;height:${TEXT.minTouchPx}px;transform:translate(-50%,-50%);}
.cy-dot.cur{background:var(--accent);transform:scale(1.3);}
.cy-dot.done{background:var(--accent2);}
.cy-body{text-align:center;background:linear-gradient(150deg,#ffffff,#fff6ea);border-radius:18px;padding:16px 12px;border:2px dashed rgba(0,0,0,.07);}
.cy-body.go{animation:cyPop .35s ease;}
@keyframes cyPop{from{opacity:.25;transform:translateY(8px)}to{opacity:1;transform:none}}
.cy-emoji{font-size:74px;line-height:1;}
.cy-name{font-weight:900;font-size:21px;color:var(--accent);margin-top:6px;}
.cy-note{color:var(--ink);font-size:14px;margin-top:6px;min-height:44px;}
.cy-next{margin-top:12px;width:100%;border:none;background:linear-gradient(90deg,var(--accent),var(--accent2));color:#fff;border-radius:24px;padding:12px;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 8px 18px rgba(0,0,0,.16);transition:.2s;}
.cy-next:hover{filter:brightness(1.06);}
/* 间距一律取法则 token（H5 媒介纪律 R2 行高≥1.6 / 间距走 4-8 阶梯），不再出现 13/14/18 这类随手值 */
.narration{position:relative;z-index:2;font-size:${TEXT.minBodyPx}px;line-height:1.75;background:rgba(255,255,255,.66);padding:${H5LAW.panelPadY}px ${H5LAW.panelPadX}px;border-radius:16px;margin-bottom:${H5LAW.blockGap}px;color:var(--ink);border:2px dashed rgba(0,0,0,.06);overflow-wrap:anywhere;}
.stage{position:relative;z-index:2;display:flex;flex-direction:column;gap:${H5LAW.blockGap}px;}
.bubble-row{display:flex;gap:${H5LAW.rowGap}px;align-items:flex-start;}
.avatar{width:46px;height:46px;border-radius:50%;color:#fff;font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 6px 14px rgba(0,0,0,.18);border:3px solid #fff;}
.bubble{position:relative;background:#fff;padding:${H5LAW.bubblePadY}px ${H5LAW.bubblePadX}px;border-radius:20px;border-top-left-radius:6px;max-width:86%;box-shadow:0 6px 16px rgba(0,0,0,.1);border:2px solid rgba(0,0,0,.04);}   /* 86%：保证中文行宽 ≥20 字（R2 行宽 20~35 字），78% 时只剩 ~17 字 */
.role-name{font-size:12px;font-weight:800;color:var(--c);margin-bottom:4px;}
.bubble-text{font-size:16px;line-height:1.6;}
.interact{position:relative;z-index:2;margin-top:${H5LAW.blockGap}px;background:rgba(255,255,255,.72);border-radius:18px;padding:${H5LAW.panelPadY}px ${H5LAW.panelPadX}px;border:2px solid rgba(0,0,0,.05);}
.interact-label{font-weight:800;font-size:14px;color:var(--accent);margin-bottom:${H5LAW.labelGap}px;display:inline-flex;align-items:center;gap:${SPACE.sm}px;}
.read-list{display:flex;flex-wrap:wrap;gap:${H5LAW.itemGap}px;min-width:0;}
.read-word{position:relative;border:2px solid var(--accent2);background:#FFF7E8;color:#C2541B;border-radius:30px;padding:${H5LAW.itemGap}px ${H5LAW.bubblePadX}px;font-size:${TEXT.minBodyPx}px;cursor:pointer;transition:.2s;font-weight:700;display:inline-flex;align-items:center;min-height:${TEXT.minTouchPx}px;flex:0 0 auto;max-width:100%;overflow-wrap:anywhere;}   /* min-height 44：R3 触控硬下限；flex:0 0 auto：词卡不许被 flex 压成"一字一行"（实测手机竖排惨状） */
.read-word:hover{transform:translateY(-3px);box-shadow:0 8px 18px rgba(255,138,91,.35);}
.read-word.on{background:var(--accent);color:#fff;border-color:var(--accent);}
.read-word .hint{display:block;font-size:11px;color:#999;font-weight:400;}
.read-word.on .hint{color:#ffe;}
.readalong-item{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;background:#fff;border-radius:12px;padding:8px 12px;}
.ra-text{font-weight:600;flex:1;min-width:140px;}
/* 跟读示范/录音：触控区必须 ≥44×44（R3），字号取正文下限 16（R2） */
.ra-play,.ra-rec{border:none;background:#5B8DEF;color:#fff;border-radius:22px;padding:0 ${SPACE.lg}px;cursor:pointer;font-size:${TEXT.minBodyPx}px;min-height:${TEXT.minTouchPx}px;display:inline-flex;align-items:center;}
/* 绘图工具栏：清除按钮与取色器同样要够大才点得准（R3） */
.draw-tools{display:flex;align-items:center;gap:${SPACE.md}px;}
.draw-clear{min-height:${TEXT.minTouchPx}px;padding:0 ${SPACE.lg}px;border-radius:22px;border:2px solid var(--accent2);background:#fff;color:#C2541B;font-size:${TEXT.minBodyPx}px;cursor:pointer;}
.draw-color{width:${TEXT.minTouchPx}px;height:${TEXT.minTouchPx}px;padding:0;border:none;background:none;cursor:pointer;}
.ra-rec{background:#FF6B6B;}
.ra-status a{color:#3FA34D;font-weight:600;}
.quiz-zone .quiz-q{font-weight:800;margin-bottom:10px;}
.quiz-opts{display:flex;flex-direction:column;gap:8px;}
.quiz-opt{border:2px solid var(--accent2);background:#fff;border-radius:14px;padding:${H5LAW.itemGap}px ${H5LAW.itemGap}px;text-align:left;cursor:pointer;font-size:15px;transition:.15s;font-weight:600;display:flex;align-items:center;min-height:${TEXT.minTouchPx}px;}   /* 选项也要 ≥44 高（R3：别把选择题做成小 chip） */
.quiz-opt:hover{background:#FFF7E8;transform:translateX(3px);}
.quiz-opt.right{background:#3FA34D;color:#fff;border-color:#3FA34D;}
.quiz-opt.wrong{background:#FF6B6B;color:#fff;border-color:#FF6B6B;}
.quiz-feedback{margin-top:10px;font-weight:700;}
.quiz-feedback.ok{color:#3FA34D;} .quiz-feedback.no{color:#FF6B6B;}
.reveal-btn{border:none;background:#C065D6;color:#fff;border-radius:24px;padding:10px 20px;cursor:pointer;font-size:15px;}
.reveal-answer{margin-top:10px;background:#fff;border-radius:12px;padding:12px 16px;color:#5A4A4A;}
.draw-canvas{border:2px dashed var(--accent2);border-radius:12px;background:#fff;width:100%;touch-action:none;cursor:crosshair;}
.draw-tools{display:flex;gap:10px;align-items:center;margin-top:8px;}
.draw-clear{border:none;background:#FF6B6B;color:#fff;border-radius:16px;padding:6px 14px;cursor:pointer;}
.draw-hint{font-size:12px;color:#999;margin-top:6px;}
.popup-trigger{border:none;background:#22B8A6;color:#fff;border-radius:20px;padding:8px 18px;cursor:pointer;}
.popup-mask{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:99;}
.popup-box{background:#fff;border-radius:18px;padding:24px 32px;max-width:80%;position:relative;}
.popup-close{position:absolute;top:8px;right:14px;font-size:22px;cursor:pointer;color:#999;}
.focus-bar{position:relative;z-index:2;margin-top:18px;background:linear-gradient(90deg,var(--accent),var(--accent2));color:#fff;padding:11px 18px;border-radius:16px;font-weight:800;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,.16);display:flex;align-items:center;gap:8px;}
.focus-bar::before{content:"✨";}
.nav-bar{display:flex;align-items:center;justify-content:center;gap:20px;margin-top:16px;}
.nav-bar button{border:none;width:52px;height:52px;border-radius:50%;background:var(--accent);color:#fff;font-size:24px;cursor:pointer;box-shadow:0 8px 18px rgba(0,0,0,.2);transition:.15s;display:flex;align-items:center;justify-content:center;}
.nav-bar button:hover{transform:scale(1.12) rotate(-4deg);}
.nav-bar button.disabled{opacity:.35;cursor:not-allowed;transform:none;}
.pg-info{font-weight:800;color:var(--accent);min-width:56px;text-align:center;font-size:16px;}
.progress{height:8px;background:rgba(0,0,0,.1);border-radius:6px;overflow:hidden;margin-top:10px;}
.progress-bar{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));width:0;transition:.3s;border-radius:6px;}
/* 翻页控件自适应（2026-09-11）：
   HD（≥768px）= 右侧竖排悬浮按钮；手机（<768px）= 隐藏按钮，靠上下滑翻页（H5 基操）。 */
@media (min-width:768px){
  .nav-bar{position:fixed;right:18px;top:50%;transform:translateY(-50%);flex-direction:column;gap:14px;margin:0;z-index:40;}
  .nav-bar button{width:46px;height:46px;font-size:20px;}
  .nav-bar .pg-info{order:-1;min-width:auto;font-size:13px;background:rgba(255,255,255,.78);border-radius:10px;padding:3px 9px;box-shadow:0 2px 8px rgba(0,0,0,.08);}
}
@media (max-width:767px){
  .nav-bar{position:fixed;left:0;right:0;bottom:6px;justify-content:center;gap:0;margin:0;z-index:40;pointer-events:none;}
  .nav-bar button{display:none;}
  .nav-bar .pg-info{pointer-events:auto;min-width:auto;font-size:12px;background:rgba(255,255,255,.72);border-radius:10px;padding:2px 9px;box-shadow:0 2px 8px rgba(0,0,0,.08);}
}
.story-header{text-align:center;margin-bottom:16px;}
.story-header .h-title{font-size:24px;font-weight:900;color:var(--accent);text-shadow:0 2px 0 rgba(255,255,255,.5);}
.story-header .h-meta{font-size:13px;color:#888;margin-top:4px;}
/* ── 形态字典 CSS（styleDNA morph，2026-09-03）：同配色下的疏密/节奏差异 ── */
/* 疏朗 loose：卡片更宽、字距更大、气泡更松 */
.morph-loose .scene{padding:44px 40px 98px;border-radius:34px;}
.morph-loose .scene-title{font-size:28px;letter-spacing:2px;}
.morph-loose .bubble-text{font-size:17px;line-height:1.8;}
.morph-loose .narration{font-size:17px;line-height:2.1;padding:16px 24px;}
.morph-loose .stage{gap:18px;}
.morph-loose .read-word{font-size:20px;}
/* 紧凑 tight：信息密度高，适合夜读/复习收束 */
.morph-tight .scene{padding:24px 24px 76px;border-radius:22px;}
.morph-tight .bubble-text{font-size:15px;line-height:1.55;}
.morph-tight .narration{font-size:15px;line-height:1.7;padding:10px 14px;}
.morph-tight .stage{gap:10px;}
.morph-tight{--title-boost:0.92;}
.morph-tight .focus-bar{font-size:13px;padding:8px 14px;}
/* motion 节奏由 --deco-dur 控制（buildStoryH5 注入 mv-* 变量） */
/* ── 版式骨架差异化（2026-09-03）：不同教学动作的页面真的长不同 ── */
.sk{position:relative;z-index:2;margin-top:16px;}
/* ── 封面页（2026-09-17 · A1）── 与内容页区分：课题居中放大，无气泡/互动/重点条 */
.scene-cover .scene-inner{align-items:center;text-align:center;}
.scene-cover .scene-title{font-size:calc(var(--fs-title) * 1.45);justify-content:center;margin-bottom:20px;}
.sk-cover{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:0;}
.sk-cover .cover-sub{font-size:14px;letter-spacing:5px;font-weight:700;color:var(--accent2);opacity:.9;}
.sk-cover .cover-meta{font-size:18px;font-weight:800;color:var(--ink);background:rgba(255,255,255,.66);border-radius:999px;padding:9px 24px;}
.sk-cover .cover-teacher{font-size:15px;color:var(--text);opacity:.85;}
/* ── 封面装饰槽位（2026-09-17 · ② 封面素材可替换）── 底图由 section 内联 style 铺满；
   元素位绝对定位、层级在内容之下（z-index:1 < 内容 2），教师换素材即换这几处 */
.cover-deco{position:absolute;z-index:1;pointer-events:none;object-fit:contain;}
.cover-deco.corner{width:88px;height:88px;}
.cover-deco.corner.c1{top:10px;left:10px;}
.cover-deco.corner.c2{top:10px;right:10px;}
.cover-deco.corner.c3{bottom:10px;left:10px;}
.cover-deco.corner.c4{bottom:10px;right:10px;}
.cover-deco.float{width:64px;height:64px;opacity:.92;}
.cover-deco.float.f1{top:15%;right:7%;}
.cover-deco.float.f2{bottom:17%;left:6%;}
.cover-deco.float.f3{top:7%;left:21%;}
.cover-deco.float.f4{bottom:8%;right:19%;}
.cover-deco.band{left:50%;transform:translateX(-50%);height:52px;width:auto;max-width:70%;}
.cover-deco.band.top{top:6px;}
.cover-deco.band.bottom{bottom:6px;}
/* 封面衬底（2026-09-17）：底图半透明衬在「主题底色之上、内容之下」（z 0 < 元素 1 < 内容 2）。
   必须单独一层 —— 给 section 设 opacity 会把课题文字一起淡掉。 */
.cover-underlay{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none;}
/* 词卡页：点读词放大成卡片网格（不再是"气泡列里塞词"） */
.sk-read .interact{background:transparent;border:0;padding:0;box-shadow:none;}
.sk-read .read-list{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;}
.sk-read .read-word{font-size:26px;padding:24px 32px;border-radius:22px;border-width:3px;min-width:118px;text-align:center;box-shadow:0 6px 16px rgba(0,0,0,.08);}
.sk-read .read-word .hint{font-size:14px;margin-top:${SPACE.sm}px;}
.sk-read .interact-label{font-size:16px;}
/* 选择页：题目居中 + 大按钮纵向，成为页面主角 */
.sk-quiz .interact{background:rgba(255,255,255,.92);border-radius:26px;padding:${SPACE.xl}px ${SPACE.xl}px;box-shadow:0 10px 26px rgba(0,0,0,.1);text-align:center;}
.sk-quiz .quiz-q{font-size:22px;font-weight:800;margin:${SPACE.sm}px 0 ${SPACE.lg}px;line-height:1.6;}
.sk-quiz .quiz-opts{gap:${H5LAW.itemGap}px;}
.sk-quiz .quiz-opt{font-size:19px;padding:${SPACE.lg}px ${SPACE.xl}px;border-radius:18px;border-width:3px;justify-content:center;}
.sk-quiz .interact-label{font-size:16px;}
/* 绘图页：画布占主体 */
.sk-draw .interact{padding:16px;}
.sk-draw .draw-canvas{height:340px;border-radius:18px;}
.sk-draw .interact-label{font-size:15px;}
/* 现象页：现象组件大区为主体（天气/雷电/循环） */
.sk-phenomenon .interact{background:transparent;border:0;padding:0;box-shadow:none;}
.sk-phenomenon .w-stage{height:260px;}
.sk-phenomenon .storm-sky{height:280px;}
.sk-phenomenon .cy-body{padding:22px 18px;}
.sk-phenomenon .cy-emoji{font-size:88px;}

/* ── 风格骨架语言 layout（2026-09-03 引入；2026-09-11 强化为"真结构差异"）──
   原则：**主题管色、风格管形、内容管交互**。此处只改"形"——留白/分栏/对齐/排列/几何，
   让同一份内容在不同风格下呈现不同版面骨架，而不是只换配色与圆角。
   骨架语义以 skills/shared/styles/{tag}.md「骨架形态语言」段为权威。 */

/* 国风：大留白 · 居中窄栏 · 细线非框 · 竖排韵味 */
.layout-china .scene{padding:64px 11% 116px;}
.layout-china .scene-title{justify-content:center;text-align:center;letter-spacing:8px;font-family:"STKaiti","KaiTi","PingFang SC",serif;font-size:30px;}
.layout-china .narration{max-width:74%;margin:0 auto 22px;text-align:center;background:transparent;border:0;border-top:1px solid rgba(120,90,60,.25);border-bottom:1px solid rgba(120,90,60,.25);border-radius:0;padding:16px 0;}
.layout-china .scene:not(.scene-transition) .stage{max-width:74%;margin:0 auto;}
.layout-china .interact{max-width:74%;margin:22px auto 0;background:transparent;border:1px solid rgba(120,90,60,.22);border-radius:2px;}
.layout-china .read-list{flex-direction:column;align-items:center;gap:16px;}
.layout-china .read-word{border-radius:3px;border-width:1px;min-width:210px;background:transparent;}
.layout-china .bubble{border-radius:16px;border-top-left-radius:3px;border:1px solid rgba(120,90,60,.28);box-shadow:0 6px 16px rgba(90,60,40,.08);}
.layout-china .quiz-opt{border-radius:8px;}
.layout-china .focus-bar{background:linear-gradient(90deg,#8a5a3c,#b07a4e);border-radius:4px;box-shadow:none;}
.layout-china .scene-transition .narration{font-family:"STKaiti","KaiTi",serif;letter-spacing:4px;font-size:24px;}

/* 科技：宽幅双栏 · 直角发光 · 左对齐标题
   注：底纹（网格）与标题装饰（色块）已由共享结构语汇生成，此处不再手写——
   此前手写的 border-bottom 会与 token 的 'block' 标题叠加，造成"又下划线又色块"的两处写。 */
.layout-tech .scene{padding:28px 5% 84px;border-radius:10px;box-shadow:0 0 0 1px rgba(80,160,255,.20),0 18px 50px rgba(20,60,120,.20);}
.layout-tech .scene-title{text-align:left;letter-spacing:1px;}
.layout-tech .narration{text-align:left;border-left:4px solid rgba(80,160,255,.60);border-radius:0;background:rgba(255,255,255,.55);}
.layout-tech .scene:not(.scene-transition) .stage{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;}
.layout-tech .interact{border:1px solid rgba(80,160,255,.38);box-shadow:0 0 18px rgba(80,160,255,.18);border-radius:6px;}
/* 窄屏自适应（2026-09-15）：原来是死写 1fr 1fr，手机 390px 下每个词卡只剩 ~155px →
   24 字的词卡被压成"每行 5 个字、竖成长条"（教师截图的实际观感）。
   改为自动列数：容器放得下几列就几列，放不下就一列占满。 */
.layout-tech .read-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;}
.layout-tech .read-word{border-radius:4px;border-width:2px;box-shadow:0 0 14px rgba(80,160,255,.22);}
.layout-tech .sk-quiz .quiz-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px;}
.layout-tech .bubble{border-radius:8px;border:1px solid rgba(80,160,255,.40);box-shadow:0 0 12px rgba(80,160,255,.18);}
.layout-tech .focus-bar{border-radius:6px;box-shadow:0 0 18px rgba(80,160,255,.30);}
.layout-tech .scene-transition .narration{max-width:560px;margin:0 auto;text-align:left;border-left:4px solid rgba(80,160,255,.6);}

/* 清新：圆润居中 · 中等留白 · 胶囊读卡 */
.layout-fresh .scene{padding:38px 7% 96px;}
.layout-fresh .scene-title{justify-content:center;text-align:center;letter-spacing:2px;}
.layout-fresh .narration{text-align:center;border-radius:22px;}
.layout-fresh .read-list{gap:16px;justify-content:center;}
.layout-fresh .read-word{border-radius:26px;}
.layout-fresh .bubble{border-radius:22px;}
.layout-fresh .scene-transition .narration{text-align:center;font-size:22px;}

/* 极简：极大留白 · 去框 · 细字左对齐 · 竖向稀疏 */
.layout-minimal .scene{padding:72px 12% 120px;}
.layout-minimal .scene-title{justify-content:flex-start;text-align:left;font-weight:600;letter-spacing:7px;font-size:20px;color:var(--ink);}
.layout-minimal .scene-title::before{content:"";}
.layout-minimal .narration{background:transparent;border:0;border-radius:0;padding:0;text-align:left;font-size:17px;}
.layout-minimal .interact{background:transparent;border:0;border-radius:0;box-shadow:none;padding:0;margin-top:28px;}
.layout-minimal .read-list{flex-direction:column;gap:20px;}
.layout-minimal .read-word{border:0;border-bottom:1px solid rgba(0,0,0,.12);border-radius:0;background:transparent;box-shadow:none;padding:8px 2px;}
.layout-minimal .bubble{border-radius:6px;border:0;background:rgba(0,0,0,.03);}
.layout-minimal .scene-transition .narration{font-size:19px;letter-spacing:2px;text-align:left;}

/* 学术：规整双栏 · 左侧编号条 · 紧凑 */
.layout-academic .scene{padding:32px 6% 88px;}
.layout-academic .scene-title{text-align:left;border-left:5px solid rgba(31,78,121,.7);padding-left:12px;}
.layout-academic .narration{text-align:left;background:rgba(255,255,255,.6);border:1px solid rgba(0,0,0,.08);border-radius:6px;}
.layout-academic .read-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;}
.layout-academic .read-word{border-radius:8px;text-align:left;}
.layout-academic .bubble{border-radius:8px;}
.layout-academic .scene-transition .narration{text-align:left;}

/* 卡通：大圆角 · 大色块 · 居中粗壮 */
.layout-cartoon .scene{padding:44px 6% 100px;}
.layout-cartoon .scene-title{justify-content:center;text-align:center;font-size:32px;}
.layout-cartoon .narration{text-align:center;border-radius:26px;background:rgba(255,255,255,.8);border:3px dashed rgba(0,0,0,.08);}
.layout-cartoon .read-list{justify-content:center;gap:18px;}
.layout-cartoon .read-word{border-radius:34px;border-width:3px;}
.layout-cartoon .bubble{border-radius:26px;}
.layout-cartoon .scene-transition .narration{font-size:24px;font-weight:900;text-align:center;}

/* ── 风格底纹/边栏/角标/圆角/标题形态：已改为由共享结构语汇生成（2026-09-11）──
   生成源：styleRegistry.STYLE_STRUCTURE（与 PPT 端同一份），见 structureCssFromTokens()。
   此处不再手写，避免"同一个视觉决定被两处写"造成两端漂移。 */

/* 学术：编号体系（读卡 01/02 · 选项 A/B）+ 密排细线 */
.layout-academic{counter-reset:acad-read;}
.layout-academic .read-word{counter-increment:acad-read;}
.layout-academic .read-word::before{content:counter(acad-read,decimal-leading-zero);font-weight:800;font-size:12px;color:rgba(31,78,121,.55);margin-right:8px;}
.layout-academic .quiz-opts{counter-reset:acad-opt;}
.layout-academic .quiz-opt{counter-increment:acad-opt;}
.layout-academic .quiz-opt::before{content:counter(acad-opt,upper-alpha) "  ";font-weight:800;color:rgba(31,78,121,.6);margin-right:6px;}
.layout-academic .interact{background:rgba(255,255,255,.72);border:1px solid rgba(31,78,121,.18);border-radius:4px;box-shadow:none;}
.layout-academic .read-word{background:rgba(255,255,255,.92);border:1px solid rgba(31,78,121,.22);}

/* 卡通：贴纸感（粗边 + 偏移实心影 + 轻微旋转） */
.layout-cartoon .read-word{border:3px solid rgba(0,0,0,.14);box-shadow:5px 5px 0 rgba(0,0,0,.14);background:#fff;}
.layout-cartoon .read-word:nth-child(odd){transform:rotate(-1.6deg);}
.layout-cartoon .read-word:nth-child(even){transform:rotate(1.6deg);}
.layout-cartoon .bubble{box-shadow:5px 5px 0 rgba(0,0,0,.10);}
.layout-cartoon .interact{border:3px dashed rgba(0,0,0,.12);border-radius:28px;background:rgba(255,255,255,.85);}
.layout-cartoon .scene-title{text-shadow:2px 2px 0 rgba(255,255,255,.85);}

/* 清新：错落轻快（虚线胶囊 + 上下错位） */
.layout-fresh .read-list{align-items:center;}
.layout-fresh .read-word{border-style:dashed;border-width:2px;border-radius:26px;background:rgba(255,255,255,.78);box-shadow:0 6px 14px rgba(0,0,0,.05);}
.layout-fresh .read-word:nth-child(odd){transform:translateY(-5px);}
.layout-fresh .read-word:nth-child(even){transform:translateY(7px);}
.layout-fresh .interact{border:2px solid rgba(255,255,255,.95);box-shadow:0 10px 24px rgba(0,0,0,.05);}

/* ── 页内自适应（2026-09-11 · 基操）：按内容填充率调字号/间距 ──
   sparse = 内容偏少（<62%），放大字号与行距把画布"撑起来"，避免空洞；
   dense  = 内容溢出（>100%），收紧字号与间距，避免溢出/截断。
   置于样式表末尾，确保优先级高于各风格/版式的固定字号。 */
.scene.sparse{--title-boost:1.15;}
.scene.sparse .scene-title{margin-bottom:18px;}
.scene.sparse .narration{font-size:19px;line-height:2.05;padding:18px 22px;margin-bottom:24px;}
.scene.sparse .bubble-text{font-size:18px;}
.scene.sparse .focus-bar{font-size:16px;padding:15px 22px;margin-top:24px;}
.scene.sparse .interact-label{font-size:15px;}
.scene.sparse .read-word{font-size:28px;padding:24px 32px;}
.scene.sparse .quiz-opt{font-size:19px;padding:18px 22px;}
.scene.sparse .interact{margin-top:24px;padding:20px 22px;}
.scene.dense{--title-boost:0.88;}
.scene.dense .scene-title{margin-bottom:10px;}
.scene.dense .narration{font-size:15px;line-height:1.62;padding:11px 14px;margin-bottom:12px;}
.scene.dense .bubble-text{font-size:14px;}
.scene.dense .interact{margin-top:12px;padding:12px 14px;}
.scene.dense .focus-bar{font-size:13px;padding:9px 14px;margin-top:12px;}
.scene.dense .bubble{margin-bottom:8px;}
`

export function buildStoryH5(story: Story): string {
  const theme = resolveStoryTheme(story.colorRoot, story.themeId)
  // 形态字典（morph 生效点 2/3：body 类驱动 density/motion；data-motif 供装饰池与未来扩展）
  const morph = resolveStoryMorph(story.colorRoot, story.themeId)
  // 风格骨架语言（layout 生效点：body 类驱动版面结构——留白/分栏/边框/卡片几何）
  const layout = resolveStoryLayout(story.themeId)
  const scenesHtml = story.scenes.map((s, i) => renderScene(s, i, story)).join('')
  // 封面口径（2026-09-17 · A1）：合成封面是 scenes[0]，但**不计入页数**（与 PPT 端同规则）。
  // 元信息已收进封面页 → 常驻页头不再重复渲染学科/年级/署名，只留 📖 课题。
  const hasCover = story.scenes[0]?.sceneType === 'cover'
  const contentTotal = story.scenes.length - (hasCover ? 1 : 0)
  const meta = hasCover ? '' : [story.subject, story.grade].filter(Boolean).join(' · ')
  const themeId = story.themeId || 'storybook'
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${esc(story.title)}</title>
<style>${RUNTIME_CSS}</style>
<style>:root{--bg1:${theme.bg1};--bg2:${theme.bg2};--card:${theme.card};--accent:${theme.accent};--accent2:${theme.accent2};--text:${theme.text};--ink:${theme.ink};}
.morph-${morph.density}{--density:${morph.density};}
.mv-${morph.motion}{--deco-dur:${morph.motion === 'calm' ? 11 : morph.motion === 'energetic' ? 3.6 : 6}s;}
${structureCssFromTokens()}
${HD_STAGE_CSS}</style>
</head>
<body class="morph-${morph.density} mv-${morph.motion} layout-${layout}" data-theme="${themeId}" data-motif="${morph.motif}" data-layout="${layout}" style="margin:0;background:linear-gradient(135deg,${theme.bg1},${theme.bg2});min-height:100vh;padding:20px 0;">
<div class="story-root" data-auto="${story.autoPlay ? '1' : '0'}" data-interval="${story.autoPlayInterval || 5000}">
  <div class="story-header">
    <div class="h-title">📖 ${esc(story.title)}</div>
    ${meta ? `<div class="h-meta">${esc(meta)}${story.teacherName ? ' · ' + esc(story.teacherName) : ''}</div>` : ''}
  </div>
  ${scenesHtml}
  <div class="progress"><div class="progress-bar"></div></div>
  <div class="nav-bar">
    <button class="prev">▲</button>
    <span class="pg-info">${hasCover ? '封面' : `<span class="pg-cur">1</span>/<span class="pg-total">${contentTotal}</span>`}</span>
    <button class="next">▼</button>
  </div>
</div>
<script>${RUNTIME_JS}</script>
</body></html>`
}
