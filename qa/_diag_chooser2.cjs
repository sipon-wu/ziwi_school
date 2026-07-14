const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
async function safeJson(p){const res=await p;const t=await res.text();try{return JSON.parse(t)}catch(e){console.log('BADJSON',res.status,t.slice(0,100));throw e}}
const post=(u,b,t)=>safeJson(fetch(B+u,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(t||'')},body:JSON.stringify(b)}))
const del=(u,t)=>fetch(B+u,{method:'DELETE',headers:{Authorization:'Bearer '+(t||'')}}).then(r=>r.status)

;(async()=>{
  const L=await post('/api/auth/login',{phone:'13800000002',password:'teacher123'})
  const token=L.token
  const created=await post('/api/lesson-plans',{title:'chooser2_'+Date.now(),subject:'语文',grade:'三年级',status:'draft',content:'# 标题\n内容'},token)
  const id=created.id
  console.log('created id:',id)

  const browser=await chromium.launch({headless:true})
  const ctx=await browser.newContext()
  const page=await ctx.newPage()
  const errors=[]; page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript((tok)=>{localStorage.setItem('zhiwei_token',tok);try{localStorage.setItem('user',JSON.stringify({name:'王',school_name:'测'}))}catch{}},token)

  await page.goto(B+'/lesson-plans/'+id,{waitUntil:'networkidle'})
  await page.waitForTimeout(1200)
  await page.locator('button:has-text("编辑")').click()
  await page.waitForTimeout(600)
  const chooserVisible=await page.locator('text=选择编辑模式').count()
  console.log('chooser visible:',chooserVisible>0)
  await page.locator('button:has-text("文档模式")').first().click()
  await page.waitForTimeout(2500)
  // 判定当前到底在哪个组件
  const url=page.url()
  const onEditor=await page.locator('button:has-text("保存为草稿")').count()
  const onView=await page.locator('button:has-text("编辑")').count()
  const md=await page.locator('.w-md-editor').count()
  const free=await page.locator('text=自由排版').count()
  const mode=await page.evaluate(()=>window.location.search)
  const aiHighlight=await page.locator('button.bg-\\[\\#02A7F0\\]:has-text("AI 模式")').count()
  const docHighlight=await page.locator('button.bg-\\[\\#02A7F0\\]:has-text("文档模式")').count()
  console.log('url:',url)
  console.log('window.location.search:',mode)
  console.log('onEditor(保存为草稿):',onEditor>0,'| onView(编辑 btn):',onView>0)
  console.log('MDEditor:',md>0,'| 自由排版:',free>0)
  console.log('AI 模式 highlighted:',aiHighlight>0,'| 文档模式 highlighted:',docHighlight>0)
  console.log('pageerrors:',errors.length)
  await del('/api/lesson-plans/'+id,token)
  await browser.close()
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)})
