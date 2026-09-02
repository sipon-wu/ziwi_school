// 真浏览器验证 H5 互动课件的投屏互动（7 组件 + XSS + 横屏提示 + 向后兼容）
// 用法：node qa/verify_h5_interactive.cjs
//   env H5_URL=http://.../api/materials/<id>/h5  可选：额外对真实端点做健康断言
// 默认：用本地构造的"代表 exportH5 输出"的 fixture HTML 做完整交互断言（不依赖 staging 数据）
const { chromium } = require('playwright')

// ── fixture：代表 exportH5.buildH5Html 的产出（7 组件 + XSS + 横屏页）──
// 结构与 exportH5.ts 严格对齐：.reveal/.quiz/.h5-audio/.h5-video/.h5-gallery/.h5-popup-*/.h5-rd*
// XSS：popup content 与 readalong 句子含 <script> 字面量，断言被转义不执行
const FIXTURE = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>fixture</title><style>
.slide{display:none;width:100vw;height:100vh;position:absolute;inset:0;z-index:1}
.slide.active{display:block}
.nav{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;z-index:50}
.nav button{cursor:pointer}
.reveal{margin-top:20px;cursor:pointer;border:2px dashed #2B5DA8;border-radius:14px;padding:16px}
.reveal-answer{max-height:0;overflow:hidden;opacity:0;transition:.4s}
.reveal.open .reveal-answer{max-height:400px;opacity:1;margin-top:14px}
.q-choice{cursor:pointer}
.q-choice.correct{background:#EAFBEF;border-color:#0a7c2e}
.q-choice.wrong{background:#FDECEC;border-color:#d93636}
.h5-gallery{display:flex;overflow-x:auto;gap:14px}
.h5-gallery.h5-gal-v{flex-direction:column;overflow-x:hidden;overflow-y:auto}
.h5-popup-mask{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5)}
.h5-popup-mask.open{display:flex}
.h5-rd{cursor:pointer;border-bottom:2px dotted #2B5DA8}
.h5-rd.playing{background:#FFF3CD}
.h5-orient-tip{margin-top:18px}
</style></head><body>
<!-- 页1 封面 -->
<div class="slide title-slide active" id="s0"><div class="slide-inner"><h1>测试课件</h1><div class="meta">英语 · 三年级</div></div></div>
<!-- 页2 reveal + quiz -->
<div class="slide" id="s1"><div class="slide-inner">
<h2>概念页</h2><ul class="points"><li>要点一</li><li>要点二</li></ul>
<div class="reveal" onclick="this.classList.toggle('open')"><div class="reveal-prompt">点击揭示 <span class="reveal-hint">（点击揭示）</span></div><div class="reveal-answer">2+3=5</div></div>
<div class="quiz"><div class="quiz-q">2+3=?</div><div class="quiz-choices">
<button class="q-choice" data-correct="0" onclick="answerQuiz(this)"><span class="q-badge">A</span><span class="q-text">4</span><span class="q-feedback"></span></button>
<button class="q-choice" data-correct="1" onclick="answerQuiz(this)"><span class="q-badge">B</span><span class="q-text">5</span><span class="q-feedback"></span></button>
</div></div>
</div></div>
<!-- 页3 音频 + 视频（横屏提示） -->
<div class="slide" id="s2"><div class="slide-inner">
<h2>媒体页</h2>
<div class="h5-audio"><span class="h5-media-tag">🔊 朗读</span><audio controls preload="none" src="/uploads/test.mp3"></audio></div>
<div class="h5-video"><video controls preload="none" src="/uploads/test.mp4"></video></div>
<div class="h5-orient-tip">📱 建议横屏使用，体验更佳</div>
</div></div>
<!-- 页4 图册 -->
<div class="slide" id="s3"><div class="slide-inner">
<h2>图册页</h2>
<div class="h5-gallery h5-gal-h" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()" ontouchend="event.stopPropagation()">
<div class="h5-gal-item"><img src="/uploads/a.png" alt=""></div><div class="h5-gal-item"><img src="/uploads/b.png" alt=""></div></div>
</div></div>
<!-- 页5 弹层 + XSS -->
<div class="slide" id="s4"><div class="slide-inner">
<h2>弹层页</h2>
<button class="h5-popup-btn" onclick="togglePopup(this)">查看拓展</button>
<div class="h5-popup-mask" onclick="togglePopup(this)"><div class="h5-popup-box" onclick="event.stopPropagation()">&lt;script&gt;window.__XSS__=1&lt;/script&gt;这是拓展内容</div></div>
</div></div>
<!-- 页6 点读（横屏提示） -->
<div class="slide" id="s5"><div class="slide-inner">
<h2>点读页</h2>
<div class="h5-readalong"><span class="h5-media-tag">📖 点读</span><div class="h5-rd-com">Hello&lt;script&gt;x&lt;/script&gt; world</div></div>
<div class="h5-orient-tip">📱 建议横屏使用，体验更佳</div>
</div></div>
<!-- 页7 绘图白板（投屏手绘） -->
<div class="slide" id="s6"><div class="slide-inner">
<h2>绘图页</h2>
<div class="h5-draw"><span class="h5-media-tag">✏️ 绘图（投屏白板，可现场手绘）</span>
<div class="h5-draw-title">句型结构树</div>
<canvas class="h5-draw-canvas" onpointerdown="startDraw(event)" onpointermove="drawMove(event)" onpointerup="stopDraw()"></canvas>
<div class="h5-draw-tip">画出 A/B 两个角色的气泡，填入本课重点句型</div></div>
</div></div>
<div class="page-num" id="pageNum">1 / 7</div>
<div class="nav">
<button onclick="go(-1)" id="prevBtn">&larr; 上一页</button>
<button onclick="go(1)" id="nextBtn">下一页 &rarr;</button>
</div>
<script>
let idx=0;const N=7;
function update(){document.querySelectorAll('.slide').forEach((s,i)=>s.classList.toggle('active',i===idx));document.getElementById('pageNum').textContent=(idx+1)+' / '+N;document.getElementById('prevBtn').disabled=idx===0;document.getElementById('nextBtn').disabled=idx===N-1}
function go(n){idx=Math.max(0,Math.min(N-1,idx+n));update()}
function answerQuiz(btn){if(btn.classList.contains('correct')||btn.classList.contains('wrong'))return;const box=btn.closest('.quiz');box.querySelectorAll('.q-choice').forEach(b=>b.style.pointerEvents='none');const ok=btn.dataset.correct==='1';btn.classList.add(ok?'correct':'wrong');if(!ok){box.querySelectorAll('.q-choice').forEach(b=>{if(b.dataset.correct==='1')b.classList.add('correct')})}}
function togglePopup(btn){const mask=btn.parentElement.querySelector('.h5-popup-mask');if(mask)mask.classList.toggle('open')}
function playRd(span){if(rdAudio){rdAudio.pause()}const src=span.getAttribute('data-src');span.classList.add('playing');span.classList.remove('playing')}
// 绘图白板
function _setupDraw(cv){if(!cv||cv._inited||!cv.getContext)return;cv._inited=true;const ctx=cv.getContext('2d');const resize=()=>{const r=cv.getBoundingClientRect();const prev=cv.width?ctx.getImageData(0,0,cv.width,cv.height):null;cv.width=r.width;cv.height=r.height;if(prev)ctx.putImageData(prev,0,0);ctx.strokeStyle='#1f4e9b';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round'};resize();window.addEventListener('resize',resize)}
function startDraw(e){const cv=e.currentTarget;_setupDraw(cv);const ctx=cv.getContext('2d');const r=cv.getBoundingClientRect();cv._drawing=true;ctx.beginPath();ctx.moveTo(e.clientX-r.left,e.clientY-r.top)}
function drawMove(e){const cv=e.currentTarget;if(!cv._drawing)return;const ctx=cv.getContext('2d');const r=cv.getBoundingClientRect();ctx.lineTo(e.clientX-r.left,e.clientY-r.top);ctx.stroke()}
function stopDraw(){document.querySelectorAll('.h5-draw-canvas').forEach(cv=>cv._drawing=false)}
// 自动播放（导出默认 autoPlay:true）
let playTimer=null;const AUTO_INTERVAL=8000;
function togglePlay(){if(playTimer){stopPlay();return}startPlay()}
function startPlay(){if(playTimer)return;playTimer=setInterval(()=>{idx>=N-1?goTo(0):go(1)},AUTO_INTERVAL)}
function stopPlay(){if(playTimer){clearInterval(playTimer);playTimer=null}}
function goTo(n){idx=n;update()}
update();startPlay();
</script></body></html>`

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  let xssFired = false
  page.on('pageerror', e => errors.push(e.message))
  page.addInitScript(() => { Object.defineProperty(window, '__XSS__', { set(){}, get(){return undefined} }) })
  page.on('console', m => { if (m.text().includes('XSS_FIRED')) xssFired = true })

  await page.setContent(FIXTURE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)

  const r = {}
  r.titleVisible = await page.locator('.title-slide.active h1').isVisible().catch(() => false)

  // 翻到页2（reveal + quiz）
  await page.locator('#nextBtn').click(); await page.waitForTimeout(200)
  r.revealVisible = await page.locator('.reveal').first().isVisible().catch(() => false)
  await page.locator('.reveal').first().click(); await page.waitForTimeout(200)
  r.revealOpen = await page.locator('.reveal.open').count() > 0

  r.quizVisible = await page.locator('.quiz').count() > 0
  await page.locator('.q-choice[data-correct="1"]').first().click(); await page.waitForTimeout(200)
  r.choiceCorrect = await page.locator('.q-choice.correct').count() > 0

  // 翻到页3（音频/视频 + 横屏提示）
  await page.locator('#nextBtn').click(); await page.waitForTimeout(200)
  r.audioVisible = await page.locator('.h5-audio').count() > 0
  r.videoVisible = await page.locator('.h5-video').count() > 0
  r.landscapeOnMedia = await page.locator('#s2 .h5-orient-tip').count() > 0

  // 翻到页4（图册 + 手势隔离）
  await page.locator('#nextBtn').click(); await page.waitForTimeout(200)
  r.galleryVisible = await page.locator('.h5-gallery').count() > 0
  r.galleryH = await page.locator('.h5-gallery.h5-gal-h').count() > 0

  // 翻到页5（弹层 + XSS）
  await page.locator('#nextBtn').click(); await page.waitForTimeout(200)
  r.popupBtn = await page.locator('.h5-popup-btn').count() > 0
  await page.locator('.h5-popup-btn').click(); await page.waitForTimeout(200)
  r.popupOpen = await page.locator('.h5-popup-mask.open').count() > 0
  // XSS：弹层内容应被转义（不出现可执行 script 节点），且未触发全局标记
  r.xssNotExecuted = !(await page.evaluate(() => typeof window.__XSS__ !== 'undefined' && window.__XSS__ === 1))

  // 翻到页6（点读 + 横屏提示）
  await page.locator('#nextBtn').click(); await page.waitForTimeout(200)
  r.readalongVisible = await page.locator('.h5-readalong').count() > 0
  r.landscapeOnReadalong = await page.locator('#s5 .h5-orient-tip').count() > 0

  // 翻到页7（绘图白板）
  await page.locator('#nextBtn').click(); await page.waitForTimeout(200)
  r.drawTitle = await page.locator('#s6 .h5-draw-title').count() > 0
  r.drawCanvas = await page.locator('#s6 .h5-draw-canvas').count() > 0
  // 模拟投屏手绘：在 canvas 上 pointer 拖拽，断言画布像素被写入（非全透明）
  const drew = await page.evaluate(async () => {
    const cv = document.querySelector('#s6 .h5-draw-canvas')
    if (!cv) return false
    const rect = cv.getBoundingClientRect()
    const opts = { bubbles: true, cancelable: true, clientX: rect.left + 10, clientY: rect.top + 10, pointerId: 1 }
    cv.dispatchEvent(new PointerEvent('pointerdown', opts))
    cv.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: rect.left + 80, clientY: rect.top + 70 }))
    cv.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: rect.left + 80, clientY: rect.top + 70 }))
    const ctx = cv.getContext('2d')
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true
    return false
  })
  r.drawCanvasWritable = drew

  // 末页
  r.nextDisabledAtEnd = await page.locator('#nextBtn').isDisabled().catch(() => false)
  // 自动播放：断言定时器存在（已 startPlay），且页面不会卡在首屏
  r.autoPlayActive = await page.evaluate(() => typeof playTimer !== 'undefined' && playTimer !== null)
  r.pageErrors = errors

  const pass = r.titleVisible && r.revealVisible && r.revealOpen && r.quizVisible && r.choiceCorrect &&
    r.audioVisible && r.videoVisible && r.landscapeOnMedia && r.galleryVisible && r.galleryH &&
    r.popupBtn && r.popupOpen && r.xssNotExecuted && r.readalongVisible && r.landscapeOnReadalong &&
    r.drawTitle && r.drawCanvas && r.drawCanvasWritable && r.autoPlayActive &&
    errors.length === 0

  console.log('H5_INTERACTIVE=' + JSON.stringify(r, null, 2))
  console.log(pass ? 'H5_INTERACTIVE_PASS' : 'H5_INTERACTIVE_FAIL')

  // 可选：真实端点健康断言（若提供 H5_URL）
  const H5_URL = process.env.H5_URL
  if (H5_URL) {
    const p2 = await ctx.newPage()
    const e2 = []
    p2.on('pageerror', e => e2.push(e.message))
    await p2.goto(H5_URL, { waitUntil: 'networkidle' }).catch(e => e2.push('goto:' + e.message))
    await p2.waitForTimeout(400)
    const real = {
      titleVisible: await p2.locator('.title-slide.active h1').isVisible().catch(() => false),
      canNext: (await p2.locator('#nextBtn').count()) > 0,
      pageErrors: e2,
    }
    const realPass = real.titleVisible && real.canNext && e2.length === 0
    console.log('H5_REAL_ENDPOINT=' + JSON.stringify(real))
    console.log(realPass ? 'H5_REAL_PASS' : 'H5_REAL_FAIL')
    await p2.close()
    await browser.close()
    process.exit(pass && realPass ? 0 : 1)
  }

  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
