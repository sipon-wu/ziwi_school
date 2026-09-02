/**
 * renderer —— 绘本式情景课件 HTML 渲染器（自包含，无外部依赖）
 *
 * 输出一段完整 <style> + <div> + <script>，可直接注入页面或保存为 .html 文件。
 * 配套 pager.ts / interactive.ts 的运行时逻辑已内联（保证"保存为独立 H5 文件"也能用）。
 */

import type { Story, StoryScene, StoryRole } from './types'
import { STORY_THEMES, ROLE_COLORS } from './types'
import { resolveAssetParams } from '../visualAsset/types'
import { getAssetsByStyle } from '../visualAsset/presets'
import { parseStyleDNA } from '../pptThemes'

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
function resolveStoryTheme(colorRoot: unknown, themeId?: string): typeof STORY_THEMES[string] {
  const base = STORY_THEMES[themeId || 'storybook'] || STORY_THEMES.storybook
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
  const styleId = story.themeId || 'storybook'
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
  if (!items.length) return ''

  return items.map((it, i) => {
    const sl = DECOR_SLOTS[i % DECOR_SLOTS.length]
    // 实例数超出槽位时做确定性偏移，避免完全重叠
    const off = Math.floor(i / DECOR_SLOTS.length) * 12
    const shift = off ? `margin:${off}px 0 0 ${off}px;` : ''
    return `<span class="deco" style="font-size:${Math.round(sl.base * it.scale)}px;opacity:${it.opacity};${sl.pos};${shift}animation-delay:${sl.d}s">${it.glyph}</span>`
  }).join('')
}

/** 单场景 → HTML 片段 */
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
    }
  }

  return `
  <section class="scene" data-index="${index}" style="background:${bg}">
    ${decoHtml}
    ${s.title ? `<div class="scene-title">${esc(s.title)}</div>` : ''}
    ${s.narration ? `<div class="narration">${esc(s.narration)}</div>` : ''}
    <div class="stage">${bubblesHtml}</div>
    ${interactionHtml}
    ${s.focus ? `<div class="focus-bar">⭐ 重点：${esc(s.focus)}</div>` : ''}
  </section>`
}

const RUNTIME_JS = `
(function(){
  // ---- 翻页引擎 ----
  var root = document.querySelector('.story-root');
  if(!root) return;
  var scenes = Array.prototype.slice.call(root.querySelectorAll('.scene'));
  var idx = 0, total = scenes.length;
  function show(i){
    idx = Math.max(0, Math.min(total-1, i));
    scenes.forEach(function(s,k){ s.classList.toggle('active', k===idx); });
    root.querySelector('.pg-cur').textContent = idx+1;
    root.querySelector('.pg-total').textContent = total;
    root.querySelector('.progress-bar').style.width = ((idx+1)/total*100)+'%';
    root.querySelector('.prev').classList.toggle('disabled', idx===0);
    root.querySelector('.next').classList.toggle('disabled', idx===total-1);
  }
  root.querySelector('.next').addEventListener('click', function(){ show(idx+1); });
  root.querySelector('.prev').addEventListener('click', function(){ show(idx-1); });
  root.addEventListener('wheel', function(e){
    e.preventDefault();
    if(root._lock) return;
    root._lock = true;
    if(e.deltaY > 0) show(idx+1); else show(idx-1);
    setTimeout(function(){ root._lock = false; }, 450);
  }, { passive:false });
  var sx=0;
  root.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, {passive:true});
  root.addEventListener('touchend', function(e){
    var dx = e.changedTouches[0].clientX - sx;
    if(Math.abs(dx) > 50){ if(dx<0) show(idx+1); else show(idx-1); }
  }, {passive:true});
  root.addEventListener('keydown', function(e){
    if(e.key==='ArrowRight'||e.key===' ') show(idx+1);
    if(e.key==='ArrowLeft') show(idx-1);
  });
  root.tabIndex = 0;

  // ---- 点读 (Web Speech TTS) ----
  function tts(text){
    try{
      if('speechSynthesis' in window){
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; u.rate = 0.9;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      }
    }catch(e){}
  }
  root.querySelectorAll('.read-word').forEach(function(b){
    b.addEventListener('click', function(){
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
    item.querySelector('.ra-play').addEventListener('click', function(){ tts(text); });
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

  show(0);
})();
`

const RUNTIME_CSS = `
.story-root{position:relative;width:100%;max-width:960px;margin:0 auto;min-height:560px;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--text,#3A2E2E);outline:none;}
.story-root{--bg1:#FFE8C9;--bg2:#FFD6E0;--card:#FFFDF8;--accent:#FF8A5B;--accent2:#FFB454;--text:#3A2E2E;--ink:#5A4A4A;}
.scene{display:none;padding:36px 30px 84px;border-radius:28px;box-shadow:0 18px 50px rgba(0,0,0,.16);min-height:480px;animation:fade .45s ease;overflow:hidden;position:relative;background:var(--card);}
.scene.active{display:block;}
@keyframes fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.deco{position:absolute;pointer-events:none;z-index:0;opacity:.92;filter:drop-shadow(0 6px 10px rgba(0,0,0,.08));animation:decoFloat 6s ease-in-out infinite;}
@keyframes decoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.scene-title{position:relative;z-index:2;font-size:26px;font-weight:900;color:var(--accent);margin-bottom:14px;letter-spacing:1px;display:flex;align-items:center;gap:8px;}
.scene-title::before{content:"🌟";font-size:22px;}
.narration{position:relative;z-index:2;font-size:16px;line-height:1.75;background:rgba(255,255,255,.66);padding:14px 18px;border-radius:16px;margin-bottom:18px;color:var(--ink);border:2px dashed rgba(0,0,0,.06);}
.stage{position:relative;z-index:2;display:flex;flex-direction:column;gap:14px;}
.bubble-row{display:flex;gap:12px;align-items:flex-start;}
.avatar{width:46px;height:46px;border-radius:50%;color:#fff;font-weight:800;font-size:20px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 6px 14px rgba(0,0,0,.18);border:3px solid #fff;}
.bubble{position:relative;background:#fff;padding:13px 18px;border-radius:20px;border-top-left-radius:6px;max-width:78%;box-shadow:0 6px 16px rgba(0,0,0,.1);border:2px solid rgba(0,0,0,.04);}
.role-name{font-size:12px;font-weight:800;color:var(--c);margin-bottom:4px;}
.bubble-text{font-size:16px;line-height:1.6;}
.interact{position:relative;z-index:2;margin-top:18px;background:rgba(255,255,255,.72);border-radius:18px;padding:16px 18px;border:2px solid rgba(0,0,0,.05);}
.interact-label{font-weight:800;font-size:14px;color:var(--accent);margin-bottom:10px;display:inline-flex;align-items:center;gap:6px;}
.read-list{display:flex;flex-wrap:wrap;gap:10px;}
.read-word{position:relative;border:2px solid var(--accent2);background:#FFF7E8;color:#C2541B;border-radius:30px;padding:9px 18px;font-size:16px;cursor:pointer;transition:.2s;font-weight:700;}
.read-word:hover{transform:translateY(-3px);box-shadow:0 8px 18px rgba(255,138,91,.35);}
.read-word.on{background:var(--accent);color:#fff;border-color:var(--accent);}
.read-word .hint{display:block;font-size:11px;color:#999;font-weight:400;}
.read-word.on .hint{color:#ffe;}
.readalong-item{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;background:#fff;border-radius:12px;padding:8px 12px;}
.ra-text{font-weight:600;flex:1;min-width:140px;}
.ra-play,.ra-rec{border:none;background:#5B8DEF;color:#fff;border-radius:20px;padding:6px 14px;cursor:pointer;font-size:13px;}
.ra-rec{background:#FF6B6B;}
.ra-status a{color:#3FA34D;font-weight:600;}
.quiz-zone .quiz-q{font-weight:800;margin-bottom:10px;}
.quiz-opts{display:flex;flex-direction:column;gap:8px;}
.quiz-opt{border:2px solid var(--accent2);background:#fff;border-radius:14px;padding:11px 15px;text-align:left;cursor:pointer;font-size:15px;transition:.15s;font-weight:600;}
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
.popup-box{background:#fff;border-radius:18px;padding:24px 28px;max-width:80%;position:relative;}
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
.story-header{text-align:center;margin-bottom:16px;}
.story-header .h-title{font-size:24px;font-weight:900;color:var(--accent);text-shadow:0 2px 0 rgba(255,255,255,.5);}
.story-header .h-meta{font-size:13px;color:#888;margin-top:4px;}
`

export function buildStoryH5(story: Story): string {
  const theme = resolveStoryTheme(story.colorRoot, story.themeId)
  const scenesHtml = story.scenes.map((s, i) => renderScene(s, i, story)).join('')
  const meta = [story.subject, story.grade].filter(Boolean).join(' · ')
  const themeId = story.themeId || 'storybook'
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>${esc(story.title)}</title>
<style>${RUNTIME_CSS}</style>
<style>:root{--bg1:${theme.bg1};--bg2:${theme.bg2};--card:${theme.card};--accent:${theme.accent};--accent2:${theme.accent2};--text:${theme.text};--ink:${theme.ink};}</style>
</head>
<body data-theme="${themeId}" style="margin:0;background:linear-gradient(135deg,${theme.bg1},${theme.bg2});min-height:100vh;padding:20px 0;">
<div class="story-root" data-auto="${story.autoPlay ? '1' : '0'}" data-interval="${story.autoPlayInterval || 5000}">
  <div class="story-header">
    <div class="h-title">📖 ${esc(story.title)}</div>
    ${meta ? `<div class="h-meta">${esc(meta)}${story.teacherName ? ' · ' + esc(story.teacherName) + '老师' : ''}</div>` : ''}
  </div>
  ${scenesHtml}
  <div class="progress"><div class="progress-bar"></div></div>
  <div class="nav-bar">
    <button class="prev">‹</button>
    <span class="pg-info"><span class="pg-cur">1</span>/<span class="pg-total">${story.scenes.length}</span></span>
    <button class="next">›</button>
  </div>
</div>
<script>${RUNTIME_JS}</script>
</body></html>`
}
