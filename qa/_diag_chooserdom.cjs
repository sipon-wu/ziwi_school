const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
async function safeJson(p){const res=await p;const t=await res.text();try{return JSON.parse(t)}catch(e){console.log('BADJSON',res.status,t.slice(0,100));throw e}}
const post=(u,b,t)=>safeJson(fetch(B+u,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(t||'')},body:JSON.stringify(b)}))
const del=(u,t)=>fetch(B+u,{method:'DELETE',headers:{Authorization:'Bearer '+(t||'')}}).then(r=>r.status)

;(async()=>{
  const L=await post('/api/auth/login',{phone:'13800000002',password:'teacher123'})
  const token=L.token
  const created=await post('/api/lesson-plans',{title:'cdom_'+Date.now(),subject:'语文',grade:'三年级',status:'draft',content:'# 标题\n内容'},token)
  const id=created.id

  const browser=await chromium.launch({headless:true})
  const ctx=await browser.newContext()
  const page=await ctx.newPage()
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript((tok)=>{localStorage.setItem('zhiwei_token',tok);try{localStorage.setItem('user',JSON.stringify({name:'王',school_name:'测'}))}catch{}},token)

  await page.goto(B+'/lesson-plans/'+id,{waitUntil:'networkidle'})
  await page.waitForTimeout(1200)
  await page.locator('button:has-text("编辑")').click()
  await page.waitForTimeout(600)
  console.log('chooser visible:',(await page.locator('text=选择编辑模式').count())>0)
  await page.locator('button:has-text("文档模式")').first().click()
  await page.waitForTimeout(2500)
  console.log('=== [chooser->doc] url:',page.url())
  console.log('=== [chooser->doc] head of #root ===')
  console.log((await page.locator('#root').innerText()).slice(0,200))
  console.log('has 编辑模式(toggle):',(await page.locator('text=编辑模式').count())>0)
  console.log('has 保存为草稿:',(await page.locator('button:has-text("保存为草稿")').count())>0)
  console.log('history state:',JSON.stringify(await page.evaluate(()=>window.history.state)))
  console.log('pageerrors:',errors.length)
  await del('/api/lesson-plans/'+id,token)
  await browser.close()
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)})
