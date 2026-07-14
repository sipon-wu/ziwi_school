const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
async function safeJson(p){const res=await p;const t=await res.text();try{return JSON.parse(t)}catch(e){console.log('BADJSON',res.status,t.slice(0,100));throw e}}
const post=(u,b,t)=>safeJson(fetch(B+u,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(t||'')},body:JSON.stringify(b)}))
const del=(u,t)=>fetch(B+u,{method:'DELETE',headers:{Authorization:'Bearer '+(t||'')}}).then(r=>r.status)
const getJ=(u,t)=>safeJson(fetch(B+u,{headers:{Authorization:'Bearer '+(t||'')}}))

;(async()=>{
  const L=await post('/api/auth/login',{phone:'13800000002',password:'teacher123'})
  const token=L.token
  const created=await post('/api/lesson-plans',{title:'navtest_'+Date.now(),subject:'语文',grade:'三年级',status:'draft',content:'# 标题\n内容'},token)
  const id=created.id

  const browser=await chromium.launch({headless:true})
  const ctx=await browser.newContext()
  const page=await ctx.newPage()
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript((tok)=>{localStorage.setItem('zhiwei_token',tok);try{localStorage.setItem('user',JSON.stringify({name:'王',school_name:'测'}))}catch{}},token)

  // 走列表页 -> 行内编辑图标（SPA 导航到 /edit）
  await page.goto(B+'/lesson-plans',{waitUntil:'networkidle'})
  await page.waitForTimeout(1000)
  // 找到我们新建的那行，点编辑图标
  const row=page.locator(`tr:has-text("${created.title}")`)
  console.log('list row found:',(await row.count())>0)
  await row.locator('button[title="编辑"]').click()
  await page.waitForTimeout(2000)
  console.log('[list->edit] url:',page.url())
  console.log('[list->edit] onEditor(保存为草稿):',(await page.locator('button:has-text("保存为草稿")').count())>0)
  console.log('[list->edit] MDEditor:',(await page.locator('.w-md-editor').count())>0)

  console.log('pageerrors:',errors.length)
  await del('/api/lesson-plans/'+id,token)
  await browser.close()
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)})
