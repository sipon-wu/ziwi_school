const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
async function safeJson(p){const res=await p;const t=await res.text();try{return JSON.parse(t)}catch(e){console.log('BADJSON',res.status,t.slice(0,100));throw e}}
const post=(u,b,t)=>safeJson(fetch(B+u,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(t||'')},body:JSON.stringify(b)}))
const getJ=(u,t)=>safeJson(fetch(B+u,{headers:{Authorization:'Bearer '+(t||'')}}))
const del=(u,t)=>fetch(B+u,{method:'DELETE',headers:{Authorization:'Bearer '+(t||'')}}).then(r=>r.status)

;(async()=>{
  const L=await post('/api/auth/login',{phone:'13800000002',password:'teacher123'})
  const token=L.token
  const created=await post('/api/lesson-plans',{title:'选择器验收_'+Date.now(),subject:'语文',grade:'三年级',status:'draft',content:'# 预览验收'},token)
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
  const chooser=await page.locator('text=选择编辑模式').count()
  console.log('PREVIEW chooser visible:',chooser>0)
  if(chooser>0){
    await page.locator('button:has-text("文档模式")').first().click()
    await page.waitForTimeout(2500)
    const url=page.url(); const md=await page.locator('.w-md-editor').count()
    const free=await page.locator('text=自由排版').count()
    const loading=await page.locator('text=加载中').count()
    console.log('AFTER choose doc -> url has mode=doc:',url.includes('mode=doc'),'| MDEditor:',md>0,'| 文档模式文案(自由排版):',free>0,'| 加载中:',loading>0,'| url='+url)
    // 再试 AI 模式
    await page.goto(B+'/lesson-plans/'+id,{waitUntil:'networkidle'})
    await page.waitForTimeout(1200)
    await page.locator('button:has-text("编辑")').click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("AI 模式")').first().click()
    await page.waitForTimeout(2500)
    const url2=page.url(); const md2=await page.locator('.w-md-editor').count()
    console.log('AFTER choose AI -> url no mode=doc:',!url2.includes('mode=doc'),'| doc editor hidden(AI mode):',md2===0)
  }
  console.log('pageerrors:',errors.length)
  await del('/api/lesson-plans/'+id,token)
  await browser.close()
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)})
