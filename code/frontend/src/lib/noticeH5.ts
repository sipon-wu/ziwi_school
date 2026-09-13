/**
 * noticeH5 —— 家校/学校宣发 H5 渲染器（长图滚动图文，2026-09-03）
 *
 * 与 courseware-h5（绘本翻页课件）不同：宣发是「手机竖屏滚动长页」，
 * 面向家长/教职工扫码阅读，不做翻页、不设问答互动。
 *
 * Markdown 语法子集（见 ai-service/skills/courseware-notice/references/家校宣发规范.md）：
 *   `# 标题`           封面主标题（全文第 1 行）
 *   `> 副标题`          封面副题（校名/日期/落款说明）
 *   `## 💙 板块标题`    章节卡片标题（emoji 随首字符）
 *   普通段落           正文（每段 ≤40 字）
 *   `- 要点`           圆点列表（每条 ≤20 字）
 *   `> 🔴 提示：…`     重点提示条（非封面副题位置）
 *   `**加粗**`         行内强调
 *   `<!-- theme: warm|sky|fresh -->`  可选主题（缺省按内容推断或 sky）
 *
 * 输出自包含 HTML（<style> 内联），可直接注入 iframe 预览或保存为 h5_html。
 */

export type NoticeTheme = 'warm' | 'sky' | 'fresh'

interface NoticeThemeCfg {
  bg1: string
  bg2: string
  coverA: string
  coverB: string
  accent: string
  accent2: string
  ink: string
}

const NOTICE_THEMES: Record<NoticeTheme, NoticeThemeCfg> = {
  warm: { bg1: '#FFF3E6', bg2: '#FFE9EF', coverA: '#FF8A5B', coverB: '#FF5E8A', accent: '#E85D2A', accent2: '#FF9A62', ink: '#5A3E33' },
  sky:  { bg1: '#E7F3FF', bg2: '#E4F7F1', coverA: '#2F8CF0', coverB: '#22C3A6', accent: '#1A74D8', accent2: '#4FA8FF', ink: '#28435E' },
  fresh:{ bg1: '#E9F8EE', bg2: '#FFF6E6', coverA: '#2FA35C', coverB: '#79C142', accent: '#1F8A4D', accent2: '#67B83E', ink: '#2E4A38' },
}

const DEFAULT_DECO: Record<NoticeTheme, string> = {
  warm: '🏫',
  sky: '☁️',
  fresh: '🌱',
}

function escN(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 行内加粗：**xx** → <strong>（先转义再处理） */
function inlineN(s: string): string {
  const e = escN(s)
  return e.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

interface Block {
  kind: 'para' | 'list' | 'tip'
  text?: string
  items?: string[]
}

export interface NoticeMeta {
  title: string
  subtitle: string
  theme: NoticeTheme
}

/** 解析 notice markdown → 元信息 + 封面段 + 章节 */
export function parseNoticeMarkdown(md: string): {
  meta: NoticeMeta
  intro: string[]            // 封面标题下、首个板块前的正文段落
  sections: { title: string; blocks: Block[] }[]
} {
  const lines = (md || '').split(/\r?\n/)
  const meta: NoticeMeta = { title: '', subtitle: '', theme: 'sky' }
  const intro: string[] = []
  const sections: { title: string; blocks: Block[] }[] = []

  let curSection: { title: string; blocks: Block[] } | null = null
  let coverZone = true

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    // 主题注释（行首）
    const tm = line.match(/^<!--\s*theme:\s*(\w+)\s*-->/i)
    if (tm) {
      const t = (tm[1] || '').toLowerCase() as NoticeTheme
      if (NOTICE_THEMES[t]) meta.theme = t
      continue
    }
    if (line.startsWith('# ')) {
      if (!meta.title) { meta.title = line.slice(2).trim(); continue }
      continue
    }
    if (line.startsWith('## ')) {
      const t = line.slice(3).trim()
      if (!t) continue
      curSection = { title: t, blocks: [] }
      sections.push(curSection)
      coverZone = false
      continue
    }
    if (line.startsWith('> ')) {
      const text = inlineN(line.slice(2).trim())
      if (!text) continue
      if (coverZone && !meta.subtitle) { meta.subtitle = text; continue }
      // 重点提示条（板块内；板块前的引用并入首个板块展示）
      if (curSection) curSection.blocks.push({ kind: 'tip', text })
      else if (sections.length) sections[sections.length - 1].blocks.push({ kind: 'tip', text })
      continue
    }
    if (/^[-*] /.test(line)) {
      const item = inlineN(line.replace(/^[-*] /, '').trim())
      if (!item) continue
      if (curSection) {
        const last = curSection.blocks[curSection.blocks.length - 1]
        if (last && last.kind === 'list') last.items!.push(item)
        else curSection.blocks.push({ kind: 'list', items: [item] })
      } else {
        intro.push(item)
      }
      continue
    }
    // 普通正文
    const text = inlineN(line)
    if (coverZone && !curSection) intro.push(text)
    else if (curSection) curSection.blocks.push({ kind: 'para', text })
  }
  if (!meta.title) meta.title = '家校通知'
  return { meta, intro, sections }
}

/** markdown → 自包含滚动长图 H5（竖版） */
export function markdownToNoticeH5(md: string, opts?: { title?: string; schoolName?: string; theme?: NoticeTheme }): string {
  const { meta, intro, sections } = parseNoticeMarkdown(md)
  const theme = opts?.theme && NOTICE_THEMES[opts.theme] ? opts.theme : meta.theme
  const cfg = NOTICE_THEMES[theme]
  if (opts?.title) meta.title = opts.title
  if (opts?.schoolName && !meta.subtitle) meta.subtitle = opts.schoolName
  const deco = DEFAULT_DECO[theme]

  const cover = `
    <header class="n-cover">
      <div class="n-deco">${deco}</div>
      <h1>${inlineN(meta.title)}</h1>
      ${meta.subtitle ? `<div class="n-sub">${inlineN(meta.subtitle)}</div>` : ''}
    </header>`

  const blockHtml = (b: Block): string => {
    if (b.kind === 'list') {
      return `<ul>${(b.items || []).map((x) => `<li>${x}</li>`).join('')}</ul>`
    }
    if (b.kind === 'tip') {
      return `<div class="n-tip">${b.text || ''}</div>`
    }
    return `<p>${b.text || ''}</p>`
  }

  const introHtml = intro.length
    ? `<div class="n-intro">${intro.map((t) => `<p>${t}</p>`).join('')}</div>`
    : ''

  const sectionsHtml = sections.map((sec) => `
    <section class="n-card">
      <h2>${sec.title}</h2>
      ${sec.blocks.map(blockHtml).join('')}
    </section>`).join('')

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${escN(meta.title)}</title>
<style>
:root{--bg1:${cfg.bg1};--bg2:${cfg.bg2};--accent:${cfg.accent};--accent2:${cfg.accent2};--ink:${cfg.ink};}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{margin:0;background:linear-gradient(180deg,var(--bg1),var(--bg2));min-height:100vh;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--ink);}
.n-root{max-width:480px;margin:0 auto;padding:18px 14px 40px;}
.n-cover{position:relative;overflow:hidden;border-radius:24px;padding:42px 26px 36px;text-align:center;
  background:linear-gradient(135deg,${cfg.coverA},${cfg.coverB});color:#fff;box-shadow:0 16px 36px rgba(0,0,0,.16);}
.n-deco{position:absolute;top:10px;right:16px;font-size:44px;opacity:.85;filter:drop-shadow(0 4px 8px rgba(0,0,0,.15));}
.n-cover h1{margin:0;font-size:26px;font-weight:900;letter-spacing:1px;text-shadow:0 2px 10px rgba(0,0,0,.18);}
.n-sub{margin-top:10px;font-size:13px;opacity:.95;}
.n-intro{margin:16px 4px;font-size:15px;line-height:1.9;}
.n-intro p{margin:0 0 10px;}
.n-card{background:rgba(255,255,255,.94);border-radius:20px;padding:18px 20px;margin-bottom:16px;
  box-shadow:0 8px 24px rgba(0,0,0,.08);border:1px solid rgba(255,255,255,.7);}
.n-card h2{margin:0 0 12px;font-size:19px;font-weight:900;color:var(--accent);letter-spacing:.5px;
  padding-bottom:10px;border-bottom:2px dashed rgba(0,0,0,.07);}
.n-card p{margin:0 0 10px;font-size:15px;line-height:1.85;}
.n-card ul{margin:6px 0 10px;padding:0;list-style:none;}
.n-card li{position:relative;padding-left:20px;margin-bottom:8px;font-size:15px;line-height:1.75;}
.n-card li::before{content:"";position:absolute;left:2px;top:9px;width:8px;height:8px;border-radius:50%;background:var(--accent2);}
.n-tip{position:relative;background:linear-gradient(90deg,rgba(255,244,229,.9),rgba(255,248,240,.6));
  border:1.5px solid rgba(255,138,91,.4);border-left:5px solid ${cfg.accent};
  border-radius:14px;padding:12px 14px;margin:10px 0;font-size:14px;line-height:1.75;color:var(--ink);}
.n-tip strong{color:${cfg.coverA};}
.n-foot{text-align:right;font-size:13px;color:var(--ink);opacity:.85;padding:6px 10px 0;}
.n-brand{text-align:center;margin-top:18px;font-size:12px;color:rgba(0,0,0,.3);}
</style></head>
<body>
<div class="n-root">
  ${cover}
  ${introHtml}
  ${sectionsHtml}
  <div class="n-foot">— 知微 · 家校宣发 —</div>
</div>
</body></html>`
}
