/**
 * 导出 H5 互动课件（自包含 HTML，跨设备浏览器打开即用）
 * 面向「课堂投屏 + 手机扫码」场景：翻页播放 + 多媒体 + 多交互。
 * 互动组件数据由 H5Slide[].interactive 结构化描述（H5Component），渲染进自包含 HTML，无需后端。
 */

import { isValidComponent, extractBullets, type H5Component, type OutlineSlide } from './exportPptx'

export interface H5Slide {
  title: string
  /** 正文要点（已转义前的原始文本） */
  points?: string[]
  /** 任意补充段落（如例题、说明） */
  body?: string
  /** 是否为封面页 */
  isTitle?: boolean
  /** 互动配置（H5Component）；缺省则纯内容页 */
  interactive?: H5Component | null
  /** 大纲备注（兼容性，旧课件可能带 notes 派生 reveal 时由调用方处理） */
  notes?: string
}

export interface CoursewareOptions {
  subject: string
  grade: string
  title: string
  teacherName?: string
  /** 投屏自动播放：开启后从首页开始按间隔自动翻页 */
  autoPlay?: boolean
  /** 自动播放间隔（秒），默认 8 */
  autoPlayInterval?: number
  /** 皮肤：ocean/vibrant/fresh，控配色/圆角/阴影/字号，不控布局 */
  themeId?: string
}

/** 将 OutlineSlide[]（编辑态提纲）转为 H5Slide[]：手动插槽优先，notes 兜底 reveal，否则 null */
export function buildH5FromOutline(outline: OutlineSlide[]): H5Slide[] {
  if (!outline.length) return []
  return outline.map((s, i) => {
    const bs = s.elements && s.elements.length
      ? extractBullets(s.elements)
      : (s.bullets || [])
    const interactive = isValidComponent(s.interactive)
      ? s.interactive
      : (s.notes ? { type: 'reveal' as const, prompt: '点击揭示：教师讲解要点', answer: s.notes } : null)
    return {
      title: s.title,
      points: bs,
      body: '',
      isTitle: i === 0,
      interactive,
    }
  })
}

function esc(s: string): string {
  if (typeof s !== 'string' && s != null) return String(s)
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 资源 URL 处理：相对 /uploads/ 在运行时基于当前文档 URL 解析（兼容教师端导出下载 file:// 与扫码服务器域两种场景）；
 * 绝对 http(s) 直通。最终经 esc 转义后入属性，防 javascript:/引号注入。
 */
function abs(url: string | undefined | null): string {
  if (!url) return ''
  const raw = String(url)
  // 先按原始值解析（/uploads/ 相对路径基于当前文档 URL 解析，兼容下载与扫码两场景），再转义注入属性防注入
  const resolved = raw.startsWith('/uploads/') ? new URL(raw, location.href).href : raw
  return esc(resolved)
}

/** 皮肤变量表（仅配色/圆角/阴影/字号，布局统一） */
const THEMES: Record<string, { bg: string; card: string; accent: string; accent2: string; text: string }> = {
  ocean: { bg: '#0f1226', card: '#fff', accent: '#1A3A6B', accent2: '#2B5DA8', text: '#222' },
  vibrant: { bg: '#1a0f1f', card: '#fff', accent: '#b5179e', accent2: '#f72585', text: '#222' },
  fresh: { bg: '#0f1f16', card: '#fff', accent: '#1b7a4b', accent2: '#2ec27e', text: '#222' },
}

/** 确定端适配提示：含 video/gallery/readalong ⇒ 提示建议横屏；其余自适应不提示 */
function needLandscapeTip(it: H5Component | null | undefined): boolean {
  if (!it || typeof it !== 'object') return false
  return it.type === 'video' || it.type === 'gallery' || it.type === 'readalong'
}

/** 生成单页互动区 HTML（7 种组件；XSS 转义 + gallery 手势隔离） */
export function renderInteractive(it: H5Component | null | undefined): string {
  if (!it || typeof it !== 'object' || typeof it.type !== 'string') return ''
  switch (it.type) {
    case 'reveal':
      return `
    <div class="reveal" onclick="this.classList.toggle('open')" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')this.classList.toggle('open')">
      <div class="reveal-prompt">${esc(it.prompt || '点击揭示')} <span class="reveal-hint">（点击揭示）</span></div>
      <div class="reveal-answer">${esc(it.answer)}</div>
    </div>`
    case 'quiz': {
      const choices = (it.options || []).map((c, ci) => `<button class="q-choice" data-correct="${ci === it.correct ? 1 : 0}" onclick="answerQuiz(this)">
        <span class="q-badge">${String.fromCharCode(65 + ci)}</span><span class="q-text">${esc(c)}</span>
        <span class="q-feedback"></span></button>`).join('')
      return `
    <div class="quiz">
      <div class="quiz-q">${esc(it.question)}</div>
      <div class="quiz-choices">${choices}</div>
    </div>`
    }
    case 'audio':
      return `<div class="h5-audio"><span class="h5-media-tag">🔊 ${esc(it.title || '音频')}</span><audio controls preload="none" src="${abs(it.src)}"></audio></div>`
    case 'video':
      return `<div class="h5-video"><video controls preload="none" ${it.poster ? `poster="${abs(it.poster)}"` : ''} src="${abs(it.src)}"></video></div>`
    case 'gallery': {
      const imgs = Array.isArray(it.images) ? it.images : []
      if (!imgs.length) return ''
      const dir = it.direction === 'v' ? 'h5-gal-v' : 'h5-gal-h'
      const items = imgs.map(img => `<div class="h5-gal-item"><img src="${abs(img)}" alt=""></div>`).join('')
      // 容器 stopPropagation 隔离全局 touch 翻页手势（touchstart+touchend 同时拦）
      return `<div class="h5-gallery ${dir}" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" ontouchend="event.stopPropagation()">${items}</div>`
    }
    case 'popup':
      return `<button class="h5-popup-btn" onclick="togglePopup(this)">${esc(it.triggerText)}</button>
    <div class="h5-popup-mask" onclick="togglePopup(this)"><div class="h5-popup-box" onclick="event.stopPropagation()">${esc(it.content)}</div></div>`
    case 'readalong': {
      const ss = Array.isArray(it.sentences) ? it.sentences : []
      if (!ss.length) return ''
      const spans = ss.map((s: any) => `<span class="h5-rd" data-src="${abs(s.src)}" onclick="playRd(this)">${esc(s.text)}</span>`).join('')
      return `<div class="h5-readalong"><span class="h5-media-tag">📖 点读（点击句子播放）</span><div class="h5-rd-wrap">${spans}</div></div>`
    }
    case 'drawing': {
      const title = it.title ? esc(it.title) : '现场绘图区'
      const hint = it.prompt ? esc(it.prompt) : '教师在投屏白板上边讲边画'
      return `<div class="h5-draw">
  <span class="h5-media-tag">✏️ 绘图（投屏白板，可现场手绘）</span>
  <div class="h5-draw-title">${title}</div>
  <div class="h5-draw-canvas" onpointerdown="startDraw(event)" onpointermove="drawMove(event)" onpointerup="stopDraw()"></div>
  <div class="h5-draw-tip">${hint}</div>
</div>`
    }
    default:
      return ''
  }
}

/**
 * 将 markdown 字符串拆成多页 H5Slide[]（供小微对话直接产出 H5 课件用）。
 * 按一级/二级标题分页，列表项提取为 points，其余正文进 body。
 */
export function mdToH5Slides(md: string): H5Slide[] {
  const lines = (md || '').split('\n')
  const slides: H5Slide[] = []
  let cur: H5Slide | null = null
  let curBody: string[] = []
  const push = () => {
    if (cur) {
      cur.body = curBody.join('\n').trim()
      slides.push(cur)
    }
    cur = null
    curBody = []
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,2})\s+(.*)$/)
    if (h) {
      push()
      cur = { title: h[2].trim(), points: [], body: '', isTitle: slides.length === 0 }
    } else if (cur) {
      const li = line.match(/^[-*]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/)
      if (li) cur.points!.push(li[1].trim())
      else if (line.trim()) curBody.push(line.trim())
    } else if (line.trim()) {
      // 无标题的散段，建一个默认页
      cur = { title: '课件', points: [], body: '', isTitle: slides.length === 0 }
      curBody.push(line.trim())
    }
  }
  push()
  if (!slides.length) slides.push({ title: '课件', points: [], body: md, isTitle: true })
  return slides
}

export function buildH5Html(slides: H5Slide[], opts: CoursewareOptions): string {
  const safeSlides = (slides && slides.length ? slides : [{ title: opts.title || '课件', isTitle: true }])
  const N = safeSlides.length
  const theme = THEMES[opts.themeId || 'ocean'] || THEMES.ocean

  const slidesHtml = safeSlides.map((s, i) => {
    const tip = needLandscapeTip(s.interactive)
      ? `<div class="h5-orient-tip">📱 建议横屏使用，体验更佳</div>` : ''
    return `<div class="slide${i === 0 ? ' active' : ''}${s.isTitle ? ' title-slide' : ''}" id="s${i}">
  <div class="slide-inner">
    ${s.isTitle
      ? `<h1>${esc(s.title)}</h1><div class="meta">${esc(opts.subject)} · ${esc(opts.grade)}${opts.teacherName ? ' · ' + esc(opts.teacherName) : ''}</div>`
      : `<h2>${esc(s.title)}</h2>${s.points && s.points.length
        ? `<ul class="points">${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
        : ''}${s.body ? `<div class="body">${esc(s.body)}</div>` : ''}`}
    ${renderInteractive(s.interactive)}
    ${tip}
  </div>
</div>`
  }).join('\n')

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${esc(opts.title)} - 知微互动课件</title>
<style>
:root{--bg:${theme.bg};--card:${theme.card};--accent:${theme.accent};--accent2:${theme.accent2};--text:${theme.text}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:var(--bg);color:var(--text);overflow:hidden;user-select:none;-webkit-tap-highlight-color:transparent}
.slide{display:none;width:100vw;height:100vh;flex-direction:column;justify-content:center;align-items:center;padding:5vw;position:absolute;inset:0}
.slide.active{display:flex}
.slide-inner{max-width:980px;width:100%;background:var(--card);color:var(--text);border-radius:24px;padding:clamp(28px,5vh,64px) clamp(28px,5vw,80px);box-shadow:0 24px 70px rgba(0,0,0,.45);min-height:54vh;display:flex;flex-direction:column;justify-content:center}
.title-slide .slide-inner{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;text-align:center}
.title-slide h1{font-size:clamp(26px,4.5vw,46px);font-weight:800;margin-bottom:18px}
.title-slide .meta{font-size:clamp(13px,2vw,17px);opacity:.85}
.slide h2{font-size:clamp(18px,3vw,30px);font-weight:700;color:var(--accent);margin-bottom:22px;border-left:5px solid var(--accent);padding-left:16px}
.points{list-style:none;display:flex;flex-direction:column;gap:14px}
.points li{font-size:clamp(15px,2.3vw,21px);line-height:1.6;padding-left:26px;position:relative;white-space:pre-wrap}
.points li:before{content:"●";color:var(--accent2);position:absolute;left:0;font-size:.8em;top:.25em}
.body{font-size:clamp(15px,2.2vw,20px);line-height:1.8;white-space:pre-wrap;margin-top:10px}
/* 点击揭示 */
.reveal{margin-top:22px;cursor:pointer;border:2px dashed var(--accent2);border-radius:14px;padding:16px 20px;background:#F2F7FF;transition:.3s}
.reveal:hover{background:#E6F0FF}
.reveal-prompt{font-size:clamp(14px,2vw,18px);color:var(--accent);font-weight:600}
.reveal-hint{font-size:.8em;color:#7a93c0;font-weight:400}
.reveal-answer{max-height:0;overflow:hidden;opacity:0;transition:.4s;font-size:clamp(15px,2.2vw,20px);line-height:1.7;margin-top:0;color:#0a7c2e}
.reveal.open .reveal-answer{max-height:400px;opacity:1;margin-top:14px}
.reveal.open{background:#EAFBEF;border-color:#0a7c2e}
.reveal.open .reveal-hint{display:none}
/* 随堂选择题 */
.quiz{margin-top:24px}
.quiz-q{font-size:clamp(15px,2.3vw,20px);font-weight:700;color:var(--accent);margin-bottom:16px}
.quiz-choices{display:flex;flex-direction:column;gap:12px}
.q-choice{display:flex;align-items:center;gap:12px;text-align:left;background:#F2F7FF;border:2px solid #d6e4ff;border-radius:12px;padding:14px 18px;font-size:clamp(14px,2.1vw,19px);cursor:pointer;transition:.2s;color:var(--text)}
.q-choice:hover{background:#E6F0FF}
.q-badge{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:var(--accent2);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.q-text{flex:1}
.q-feedback{flex:0 0 auto;font-weight:700}
.q-choice.correct{background:#EAFBEF;border-color:#0a7c2e}
.q-choice.correct .q-badge{background:#0a7c2e}
.q-choice.correct .q-feedback:after{content:"✓"}
.q-choice.wrong{background:#FDECEC;border-color:#d93636}
.q-choice.wrong .q-badge{background:#d93636}
.q-choice.wrong .q-feedback:after{content:"✗"}
/* 多媒体 */
.h5-audio,.h5-video{margin-top:20px;display:flex;flex-direction:column;gap:10px}
.h5-video video{width:100%;max-height:52vh;border-radius:14px;background:#000}
.h5-audio audio{width:100%}
.h5-media-tag{font-size:clamp(13px,2vw,16px);color:var(--accent);font-weight:600}
/* 图册（scroll-snap 纯 CSS，无 JS；容器已隔离翻页手势） */
.h5-gallery{margin-top:20px;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;gap:14px;padding-bottom:8px}
.h5-gallery.h5-gal-v{flex-direction:column;overflow-x:hidden;overflow-y:auto;scroll-snap-type:y mandatory;max-height:56vh}
.h5-gal-item{flex:0 0 auto;scroll-snap-align:center;width:min(72vw,640px);height:min(46vh,360px);display:flex;align-items:center;justify-content:center;background:#f3f5fa;border-radius:14px}
.h5-gal-item img{max-width:100%;max-height:100%;object-fit:contain;border-radius:14px}
/* 弹层 */
.h5-popup-btn{margin-top:20px;align-self:flex-start;background:var(--accent2);color:#fff;border:none;border-radius:12px;padding:12px 22px;font-size:clamp(14px,2vw,18px);cursor:pointer}
.h5-popup-mask{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;align-items:center;justify-content:center}
.h5-popup-mask.open{display:flex}
.h5-popup-box{background:#fff;color:var(--text);max-width:80vw;max-height:70vh;overflow:auto;border-radius:16px;padding:28px 32px;font-size:clamp(14px,2.1vw,18px);line-height:1.7;box-shadow:0 20px 60px rgba(0,0,0,.4)}
/* 点读 */
.h5-readalong{margin-top:20px;display:flex;flex-direction:column;gap:12px}
.h5-rd-wrap{font-size:clamp(16px,2.5vw,22px);line-height:2;white-space:pre-wrap}
.h5-rd{cursor:pointer;border-bottom:2px dotted var(--accent2);padding:0 2px;transition:.15s}
.h5-rd:hover{background:#E6F0FF}
.h5-rd.playing{background:#FFF3CD}
/* 横屏提示 */
.h5-orient-tip{margin-top:18px;font-size:clamp(12px,1.8vw,15px);color:#7a93c0;background:rgba(43,93,168,.08);border-radius:10px;padding:8px 14px;align-self:flex-start}
/* 导航 */
.nav{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;z-index:10}
.nav button{background:rgba(255,255,255,.16);border:none;color:#fff;padding:10px 22px;border-radius:12px;font-size:14px;cursor:pointer;transition:.2s}
.nav button:hover{background:rgba(255,255,255,.28)}
.nav button:disabled{opacity:.3;cursor:default}
.nav .play{background:rgba(43,93,168,.55);min-width:96px}
.nav .play:hover{background:rgba(43,93,168,.8)}
.nav .dots{display:flex;gap:8px}
.nav .dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3);transition:.2s}
.nav .dot.active{background:#fff;width:26px;border-radius:4px}
.brand{position:fixed;top:16px;right:24px;z-index:10;font-size:11px;color:rgba(255,255,255,.3);display:flex;align-items:center;gap:6px}
.page-num{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);font-size:12px;color:rgba(255,255,255,.3)}
@keyframes fadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.slide.active .slide-inner{animation:fadeIn .45s ease-out}
@media(max-width:768px){.slide-inner{padding:24px;border-radius:16px}.q-choice{padding:12px 14px}}
.h5-draw{margin-top:14px}
.h5-draw-title{font-size:15px;font-weight:600;color:#1f4e9b;margin:6px 0}
.h5-draw-canvas{width:100%;height:180px;background:#fff;border:2px dashed #b9c7e0;border-radius:12px;touch-action:none;cursor:crosshair}
.h5-draw-tip{font-size:12px;color:#6b7280;margin-top:6px}
</style></head><body>
<div class="brand">知微 · 互动课件</div>
${slidesHtml}
<div class="page-num" id="pageNum">1 / ${N}</div>
<div class="nav">
  <button onclick="go(-1)" id="prevBtn">&larr; 上一页</button>
  <div class="dots">${safeSlides.map((_, i) => `<div class="dot${i === 0 ? ' active' : ''}" onclick="goTo(${i})"></div>`).join('')}</div>
  <button onclick="go(1)" id="nextBtn">下一页 &rarr;</button>
  <button class="play" id="playBtn" onclick="togglePlay()">▶ 播放</button>
</div>
<script>
let idx=0;const N=${N};
const AUTO_INTERVAL=${opts.autoPlayInterval && opts.autoPlayInterval > 0 ? opts.autoPlayInterval : 8}*1000;
let playTimer=null;
function update(){document.querySelectorAll('.slide').forEach((s,i)=>s.classList.toggle('active',i===idx));document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===idx));document.getElementById('pageNum').textContent=(idx+1)+' / '+N;document.getElementById('prevBtn').disabled=idx===0;document.getElementById('nextBtn').disabled=idx===N-1}
function go(n){idx=Math.max(0,Math.min(N-1,idx+n));update()}
function goTo(n){idx=n;update()}
function togglePlay(){if(playTimer){stopPlay();return}startPlay()}
function startPlay(){document.getElementById('playBtn').textContent='⏸ 暂停';playTimer=setInterval(()=>{if(idx>=N-1){goTo(0)}else{go(1)}},AUTO_INTERVAL)}
function stopPlay(){document.getElementById('playBtn').textContent='▶ 播放';if(playTimer){clearInterval(playTimer);playTimer=null}}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' ')go(1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')go(-1);if(e.key==='p'||e.key==='P')togglePlay()})
let sx=0;document.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true})
document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){dx<0?go(1):go(-1)}},{passive:true})
// 手动翻页时暂停自动播放，避免与定时器抢页
const _origGo=go, _origGoTo=goTo;
go=function(n){stopPlay();_origGo(n)};
goTo=function(n){stopPlay();_origGoTo(n)};
function answerQuiz(btn){if(btn.classList.contains('correct')||btn.classList.contains('wrong'))return;const box=btn.closest('.quiz');box.querySelectorAll('.q-choice').forEach(b=>b.style.pointerEvents='none');const ok=btn.dataset.correct==='1';btn.classList.add(ok?'correct':'wrong');if(!ok){box.querySelectorAll('.q-choice').forEach(b=>{if(b.dataset.correct==='1')b.classList.add('correct')})}}
function togglePopup(btn){const mask=btn.parentElement.querySelector('.h5-popup-mask');if(mask)mask.classList.toggle('open')}
// ── 绘图白板（投屏手绘，教师边讲边画）──
function _setupDraw(cv){if(!cv||cv._inited||!cv.getContext)return;cv._inited=true;const ctx=cv.getContext('2d');const resize=()=>{const r=cv.getBoundingClientRect();const prev=cv.width?ctx.getImageData(0,0,cv.width,cv.height):null;cv.width=r.width;cv.height=r.height;if(prev)ctx.putImageData(prev,0,0);ctx.strokeStyle='#1f4e9b';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round'};resize();window.addEventListener('resize',resize)}
function startDraw(e){const cv=e.currentTarget;_setupDraw(cv);const ctx=cv.getContext('2d');const r=cv.getBoundingClientRect();cv._drawing=true;ctx.beginPath();ctx.moveTo(e.clientX-r.left,e.clientY-r.top)}
function drawMove(e){const cv=e.currentTarget;if(!cv._drawing)return;const ctx=cv.getContext('2d');const r=cv.getBoundingClientRect();ctx.lineTo(e.clientX-r.left,e.clientY-r.top);ctx.stroke()}
function stopDraw(){document.querySelectorAll('.h5-draw-canvas').forEach(cv=>cv._drawing=false)}
let rdAudio=null;
function playRd(span){if(rdAudio){rdAudio.pause()}const src=span.getAttribute('data-src');if(!src)return;document.querySelectorAll('.h5-rd.playing').forEach(s=>s.classList.remove('playing'));span.classList.add('playing');rdAudio=new Audio(src);rdAudio.play().catch(()=>{});rdAudio.onended=()=>span.classList.remove('playing')}
update()
${opts.autoPlay ? 'startPlay();' : ''}
</script></body></html>`

  return html
}

export function exportH5Courseware(slides: H5Slide[], opts: CoursewareOptions): Blob
export function exportH5Courseware(content: string, opts: CoursewareOptions): Blob
export function exportH5Courseware(arg: H5Slide[] | string, opts: CoursewareOptions): Blob {
  const slides: H5Slide[] = Array.isArray(arg) ? arg : mdToH5Slides(arg)
  return new Blob([buildH5Html(slides, opts)], { type: 'text/html;charset=utf-8' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
