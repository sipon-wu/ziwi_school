/**
 * 导出 H5 课件（自包含HTML，跨设备浏览器打开即用）
 * 支持未来混编：预留 interactive 插槽
 */
import { parseSections } from './parseSections'

interface CoursewareOptions {
  subject: string; grade: string; title: string
  teacherName?: string
}

export function exportH5Courseware(content: string, opts: CoursewareOptions): Blob {
  const sections = parseSections(content).filter(s => s.body.trim())
  const slides = sections.map((sec, i) => {
    const isTitle = i === 0
    return {
      title: sec.title,
      body: escapeHtml(sec.body),
      isTitle,
      interactive: null as string | null  // 预留混编插槽
    }
  })

  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)} - 知微课件</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:#1a1a2e;color:#eee;overflow:hidden;user-select:none}
.slide{display:none;width:100vw;height:100vh;flex-direction:column;justify-content:center;align-items:center;padding:5vw}
.slide.active{display:flex}
.slide-inner{max-width:960px;width:100%;background:#fff;color:#333;border-radius:24px;padding:clamp(24px,5vh,64px) clamp(24px,5vw,80px);box-shadow:0 20px 60px rgba(0,0,0,.3);min-height:55vh;display:flex;flex-direction:column;justify-content:center}
.title-slide .slide-inner{background:linear-gradient(135deg,#1A3A6B,#2B5DA8);color:#fff;text-align:center}
.title-slide h1{font-size:clamp(24px,4vw,42px);font-weight:800;margin-bottom:16px}
.title-slide .meta{font-size:clamp(13px,2vw,16px);opacity:.8}
.slide h2{font-size:clamp(18px,3vw,28px);font-weight:700;color:#1A3A6B;margin-bottom:24px;border-left:4px solid #1A3A6B;padding-left:16px}
.slide .body{font-size:clamp(15px,2.2vw,20px);line-height:1.9;white-space:pre-wrap;flex:1}
.nav{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;z-index:10}
.nav button{background:rgba(255,255,255,.15);border:none;color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;cursor:pointer;transition:.2s}
.nav button:hover{background:rgba(255,255,255,.25)}
.nav button:disabled{opacity:.3;cursor:default}
.nav .dots{display:flex;gap:8px}
.nav .dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3);transition:.2s}
.nav .dot.active{background:#fff;width:24px;border-radius:4px}
.brand{position:fixed;top:16px;right:24px;z-index:10;font-size:11px;color:rgba(255,255,255,.25);display:flex;align-items:center;gap:6px}
.brand img{width:18px;height:18px;border-radius:4px;opacity:.5}
.page-num{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);font-size:12px;color:rgba(255,255,255,.3)}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.slide.active .slide-inner{animation:fadeIn .4s ease-out}
@media(max-width:768px){.slide-inner{padding:24px;border-radius:16px}}
</style></head><body>
<div class="brand"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%231A3A6B'/%3E%3Ctext x='12' y='17' text-anchor='middle' fill='white' font-size='14'%3E微%3C/text%3E%3C/svg%3E">知微·ziwi.cn</div>
${slides.map((s, i) => `
<div class="slide${i===0?' active':''}${s.isTitle?' title-slide':''}" id="s${i}">
  <div class="slide-inner">
    ${s.isTitle
      ? `<h1>${s.title}</h1><div class="meta">${escapeHtml(opts.subject)} · ${escapeHtml(opts.grade)}${opts.teacherName ? ' · '+escapeHtml(opts.teacherName) : ''}</div>`
      : `<h2>${s.title}</h2><div class="body">${s.body}</div>`}
    ${s.interactive ? `<div class="interactive">${s.interactive}</div>` : ''}
  </div>
</div>`).join('\n')}
<div class="page-num" id="pageNum">1 / ${slides.length}</div>
<div class="nav">
  <button onclick="go(-1)" id="prevBtn">&larr;</button>
  <div class="dots">${slides.map((_,i)=>`<div class="dot${i===0?' active':''}" onclick="goTo(${i})"></div>`).join('')}</div>
  <button onclick="go(1)" id="nextBtn">&rarr;</button>
</div>
<script>
let idx=0;const N=${slides.length};
function update(){document.querySelectorAll('.slide').forEach((s,i)=>{s.classList.toggle('active',i===idx)});document.querySelectorAll('.dot').forEach((d,i)=>{d.classList.toggle('active',i===idx)});document.getElementById('pageNum').textContent=\`\${idx+1} / \${N}\`;document.getElementById('prevBtn').disabled=idx===0;document.getElementById('nextBtn').disabled=idx===N-1}
function go(n){idx=Math.max(0,Math.min(N-1,idx+n));update()}
function goTo(n){idx=n;update()}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' ')go(1);if(e.key==='ArrowLeft'||e.key==='ArrowUp')go(-1)})
update()
</script></body></html>`

  return new Blob([html], { type: 'text/html;charset=utf-8' })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
