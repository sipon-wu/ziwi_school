const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
async function safeJson(p){const res=await p;const t=await res.text();try{return JSON.parse(t)}catch(e){console.log('BADJSON',res.status,t.slice(0,100));throw e}}
const post=(u,b,t)=>safeJson(fetch(B+u,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(t||'')},body:JSON.stringify(b)}))
const getJ=(u,t)=>safeJson(fetch(B+u,{headers:{Authorization:'Bearer '+(t||'')}}))
const del=(u,t)=>fetch(B+u,{method:'DELETE',headers:{Authorization:'Bearer '+(t||'')}}).then(r=>r.status)

;(async()=>{
  const L=await post('/api/auth/login',{phone:'13800000002',password:'teacher123'})
  const token=L.token
  const created=await post('/api/lesson-plans',{title:'docmode_'+Date.now(),subject:'语文',grade:'三年级',status:'draft',content:'# 标题\n内容'},token)
  const id=created.id
  console.log('created id:',id)

  const browser=await chromium.launch({headless:true})
  const ctx=await browser.newContext()
  const page=await ctx.newPage()
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript((tok)=>{localStorage.setItem('zhiwei_token',tok);try{localStorage.setItem('user',JSON.stringify({name:'王',school_name:'测'}))}catch{}},token)

  // A) NEW plan doc mode
  await page.goto(B+'/lesson-plans/'+id+'/edit?mode=doc',{waitUntil:'networkidle'})
  await page.waitForTimeout(1500)
  console.log('[NEW plan] editMode=doc url:',page.url().includes('mode=doc'),
    '| MDEditor:',(await page.locator('.w-md-editor').count())>0,
    '| 自由排版:',(await page.locator('text=自由排版').count())>0)

  // B) EXISTING plan doc mode via URL
  await page.goto(B+'/lesson-plans/'+id+'/edit?mode=doc',{waitUntil:'networkidle'})
  await page.waitForTimeout(2500)
  console.log('[EXISTING url] MDEditor:',(await page.locator('.w-md-editor').count())>0,
    '| 自由排版:',(await page.locator('text=自由排版').count())>0)

  // C) EXISTING plan -> click 文档模式 toggle button in editor
  await page.locator('button:has-text("文档模式")').first().click()
  await page.waitForTimeout(1500)
  console.log('[EXISTING click toggle] MDEditor:',(await page.locator('.w-md-editor').count())>0,
    '| 自由排版:',(await page.locator('text=自由排版').count())>0,
    '| editMode label AI highlighted:',(await page.locator('button.bg-\\[\\#02A7F0\\]:has-text("AI 模式")').count())>0)

  console.log('pageerrors:',errors.length)
  await del('/api/lesson-plans/'+id,token)
  await browser.close()
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)})
