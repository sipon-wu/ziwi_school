/**
 * 导出 H5 互动课件（自包含 HTML，跨设备浏览器打开即用）
 * 面向「课堂投屏」场景：翻页播放 + 点击揭示 + 随堂点选互动 + 动画
 * 互动组件数据由 H5Slide[] 结构化描述，渲染进自包含 HTML，无需后端。
 */

export interface H5Choice {
  text: string
  correct?: boolean
  explain?: string
}

export interface H5Interactive {
  /** 点击揭示：隐藏区，点击后翻牌显示（如答案/关键点） */
  reveal?: { prompt: string; answer: string }
  /** 随堂选择题：投屏后全班观看，点选即时反馈 */
  quiz?: { question: string; choices: H5Choice[] }
}

export interface H5Slide {
  title: string
  /** 正文要点（已转义前的原始文本） */
  points?: string[]
  /** 任意补充段落（如例题、说明） */
  body?: string
  /** 是否为封面页 */
  isTitle?: boolean
  /** 互动配置；缺省则纯内容页 */
  interactive?: H5Interactive | null
}

export interface CoursewareOptions {
  subject: string
  grade: string
  title: string
  teacherName?: string
}

/** 将 OutlineSlide[]（AI 生成的课件提纲）转为 H5Slide[]（默认无互动纯内容页，首段作封面） */
export function buildH5FromOutline(outline: { title?: string; heading?: string; points?: string[]; body?: string }[]): H5Slide[] {
  if (!outline.length) return []
  return outline.map((s, i) => ({
    title: s.title || s.heading || `第 ${i + 1} 页`,
    points: s.points || [],
    body: s.body || '',
    isTitle: i === 0,
    interactive: null,
  }))
}

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 生成单页互动区 HTML（点击揭示 / 随堂选择题） */
function renderInteractive(it: H5Interactive | null | undefined): string {
  if (!it) return ''
  if (it.reveal) {
    return `
    <div class="reveal" onclick="this.classList.toggle('open')" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')this.classList.toggle('open')">
      <div class="reveal-prompt">${esc(it.reveal.prompt)} <span class="reveal-hint">（点击揭示）</span></div>
      <div class="reveal-answer">${esc(it.reveal.answer)}</div>
    </div>`
  }
  if (it.quiz) {
    const choices = it.quiz.choices
      .map((c, ci) => `<button class="q-choice" data-correct="${c.correct ? 1 : 0}" data-explain="${esc(c.explain || '')}" onclick="answerQuiz(this)">
        <span class="q-badge">${String.fromCharCode(65 + ci)}</span><span class="q-text">${esc(c.text)}</span>
        <span class="q-feedback"></span></button>`)
      .join('')
    return `
    <div class="quiz">
      <div class="quiz-q">${esc(it.quiz.question)}</div>
      <div class="quiz-choices">${choices}</div>
      <div class="quiz-explain" style="display:none"></div>
    </div>`
  }
  return ''
}

export function buildH5Html(slides: H5Slide[], opts: CoursewareOptions): string {
  const safeSlides = (slides && slides.length ? slides : [{ title: opts.title || '课件', isTitle: true }])
  const N = safeSlides.length

  const slidesHtml = safeSlides.map((s, i) => `
<div class="slide${i === 0 ? ' active' : ''}${s.isTitle ? ' title-slide' : ''}" id="s${i}">
  <div class="slide-inner">
    ${s.isTitle
      ? `<h1>${esc(s.title)}</h1><div class="meta">${esc(opts.subject)} · ${esc(opts.grade)}${opts.teacherName ? ' · ' + esc(opts.teacherName) : ''}</div>`
      : `<h2>${esc(s.title)}</h2>${s.points && s.points.length
        ? `<ul class="points">${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
        : ''}${s.body ? `<div class="body">${esc(s.body)}</div>` : ''}`}
    ${renderInteractive(s.interactive)}
  </div>
</div>`).join('\n')

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${esc(opts.title)} - 知微互动课件</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:#0f1226;color:#222;overflow:hidden;user-select:none;-webkit-tap-highlight-color:transparent}
.slide{display:none;width:100vw;height:100vh;flex-direction:column;justify-content:center;align-items:center;padding:5vw;position:absolute;inset:0}
.slide.active{display:flex}
.slide-inner{max-width:980px;width:100%;background:#fff;color:#222;border-radius:24px;padding:clamp(28px,5vh,64px) clamp(28px,5vw,80px);box-shadow:0 24px 70px rgba(0,0,0,.45);min-height:54vh;display:flex;flex-direction:column;justify-content:center}
.title-slide .slide-inner{background:linear-gradient(135deg,#1A3A6B,#2B5DA8);color:#fff;text-align:center}
.title-slide h1{font-size:clamp(26px,4.5vw,46px);font-weight:800;margin-bottom:18px}
.title-slide .meta{font-size:clamp(13px,2vw,17px);opacity:.85}
.slide h2{font-size:clamp(18px,3vw,30px);font-weight:700;color:#1A3A6B;margin-bottom:22px;border-left:5px solid #1A3A6B;padding-left:16px}
.points{list-style:none;display:flex;flex-direction:column;gap:14px}
.points li{font-size:clamp(15px,2.3vw,21px);line-height:1.6;padding-left:26px;position:relative;white-space:pre-wrap}
.points li:before{content:"●";color:#2B5DA8;position:absolute;left:0;font-size:.8em;top:.25em}
.body{font-size:clamp(15px,2.2vw,20px);line-height:1.8;white-space:pre-wrap;margin-top:10px}
/* 点击揭示 */
.reveal{margin-top:22px;cursor:pointer;border:2px dashed #2B5DA8;border-radius:14px;padding:16px 20px;background:#F2F7FF;transition:.3s}
.reveal:hover{background:#E6F0FF}
.reveal-prompt{font-size:clamp(14px,2vw,18px);color:#1A3A6B;font-weight:600}
.reveal-hint{font-size:.8em;color:#7a93c0;font-weight:400}
.reveal-answer{max-height:0;overflow:hidden;opacity:0;transition:.4s;font-size:clamp(15px,2.2vw,20px);line-height:1.7;margin-top:0;color:#0a7c2e}
.reveal.open .reveal-answer{max-height:400px;opacity:1;margin-top:14px}
.reveal.open{background:#EAFBEF;border-color:#0a7c2e}
.reveal.open .reveal-hint{display:none}
/* 随堂选择题 */
.quiz{margin-top:24px}
.quiz-q{font-size:clamp(15px,2.3vw,20px);font-weight:700;color:#1A3A6B;margin-bottom:16px}
.quiz-choices{display:flex;flex-direction:column;gap:12px}
.q-choice{display:flex;align-items:center;gap:12px;text-align:left;background:#F2F7FF;border:2px solid #d6e4ff;border-radius:12px;padding:14px 18px;font-size:clamp(14px,2.1vw,19px);cursor:pointer;transition:.2s;color:#222}
.q-choice:hover{background:#E6F0FF}
.q-badge{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:#2B5DA8;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.q-text{flex:1}
.q-feedback{flex:0 0 auto;font-weight:700}
.q-choice.correct{background:#EAFBEF;border-color:#0a7c2e}
.q-choice.correct .q-badge{background:#0a7c2e}
.q-choice.correct .q-feedback:after{content:"✓"}
.q-choice.wrong{background:#FDECEC;border-color:#d93636}
.q-choice.wrong .q-badge{background:#d93636}
.q-choice.wrong .q-feedback:after{content:"✗"}
.quiz-explain{margin-top:14px;padding:12px 16px;background:#FFFBE6;border-radius:10px;font-size:clamp(13px,2vw,17px);color:#7a5b00;line-height:1.6}
/* 导航 */
.nav{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;z-index:10}
.nav button{background:rgba(255,255,255,.16);border:none;color:#fff;padding:10px 22px;border-radius:12px;font-size:14px;cursor:pointer;transition:.2s}
.nav button:hover{background:rgba(255,255,255,.28)}
.nav button:disabled{opacity:.3;cursor:default}
.nav .dots{display:flex;gap:8px}
.nav .dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3);transition:.2s}
.nav .dot.active{background:#fff;width:26px;border-radius:4px}
.brand{position:fixed;top:16px;right:24px;z-index:10;font-size:11px;color:rgba(255,255,255,.3);display:flex;align-items:center;gap:6px}
.page-num{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);font-size:12px;color:rgba(255,255,255,.3)}
@keyframes fadeIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.slide.active .slide-inner{animation:fadeIn .45s ease-out}
@media(max-width:768px){.slide-inner{padding:24px;border-radius:16px}.q-choice{padding:12px 14px}}
</style></head><body>
<div class="brand">知微 · 互动课件</div>
${slidesHtml}
<div class="page-num" id="pageNum">1 / ${N}</div>
<div class="nav">
  <button onclick="go(-1)" id="prevBtn">&larr; 上一页</button>
  <div class="dots">${safeSlides.map((_, i) => `<div class="dot${i === 0 ? ' active' : ''}" onclick="goTo(${i})"></div>`).join('')}</div>
  <button onclick="go(1)" id="nextBtn">下一页 &rarr;</button>
</div>
<script>
let idx=0;const N=${N};
function update(){document.querySelectorAll('.slide').forEach((s,i)=>s.classList.toggle('active',i===idx));document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===idx));document.getElementById('pageNum').textContent=(idx+1)+' / '+N;document.getElementById('prevBtn').disabled=idx===0;document.getElementById('nextBtn').disabled=idx===N-1}
function go(n){idx=Math.max(0,Math.min(N-1,idx+n));update()}
function goTo(n){idx=n;update()}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' ')go(1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')go(-1)})
let sx=0;document.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true})
document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){dx<0?go(1):go(-1)}},{passive:true})
function answerQuiz(btn){if(btn.classList.contains('correct')||btn.classList.contains('wrong'))return;const box=btn.closest('.quiz');box.querySelectorAll('.q-choice').forEach(b=>b.style.pointerEvents='none');const ok=btn.dataset.correct==='1';btn.classList.add(ok?'correct':'wrong');const exp=box.querySelector('.quiz-explain');const ex=btn.dataset.explain;if(ex){exp.style.display='block';exp.textContent=ex}if(!ok){box.querySelectorAll('.q-choice').forEach(b=>{if(b.dataset.correct==='1')b.classList.add('correct')})}}
update()
</script></body></html>`

  return html
}

export function exportH5Courseware(slides: H5Slide[], opts: CoursewareOptions): Blob
export function exportH5Courseware(content: string, opts: CoursewareOptions): Blob
export function exportH5Courseware(arg: H5Slide[] | string, opts: CoursewareOptions): Blob {
  const slides: H5Slide[] = Array.isArray(arg)
    ? arg
    : [{ title: opts.title || '课件', body: arg, isTitle: true }]
  return new Blob([buildH5Html(slides, opts)], { type: 'text/html;charset=utf-8' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
