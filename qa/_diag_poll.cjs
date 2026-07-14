const { chromium } = require('playwright')
const B = 'http://school1.ziwi.cn'
async function safeJson(p){const res=await p;const t=await res.text();try{return JSON.parse(t)}catch(e){console.log('BADJSON',res.status,t.slice(0,100));throw e}}
const post=(u,b,t)=>safeJson(fetch(B+u,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(t||'')},body:JSON.stringify(b)}))
const del=(u,t)=>fetch(B+u,{method:'DELETE',headers:{Authorization:'Bearer '+(t||'')}}).then(r=>r.status)

;(async()=>{
  const L=await post('/api/auth/login',{phone:'13800000002',password:'teacher123'})
  const token=L.token
  const created=await post('/api/lesson-plans',{title:'poll_'+Date.now(),subject:'语文',grade:'三年级',status:'draft',content:'# 标题\n正文内容'},token)
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
  await page.locator('button:has-text("文档模式")').first().click()
  // poll up to 6s
  let md=false
  for (let i=0;i<12;i++){
    await page.waitForTimeout(500)
    md=(await page.locator('.w-md-editor').count())>0
    if (md) { console.log('MDEditor appeared after ~'+((i+1)*500+3100)+'ms'); break }
  }
  console.log('final MDEditor:',md,'| 自由排版:',(await page.locator('text=自由排版').count())>0)
  // 测试保存落库：在 MDEditor 输入，再点保存为草稿，再查库
  if (md){
    const ta=page.locator('.w-md-editor textarea').first()
    await ta.click()
    await ta.fill('# 文档模式验收\n这是通过预览浮层进入的文档模式。')
    await page.waitForTimeout(500)
    await page.locator('button:has-text("保存为草稿")').click()
    await page.waitForTimeout(800)
    const got=await safeJson(fetch(B+'/api/lesson-plans/'+id,{headers:{Authorization:'Bearer '+token}}))
    console.log('saved content includes 文档模式验收:',(got.content||'').includes('文档模式验收'))
  }
  console.log('pageerrors:',errors.length)
  await del('/api/lesson-plans/'+id,token)
  await browser.close()
})().catch(e=>{console.log('FATAL',e.message);process.exit(1)})
