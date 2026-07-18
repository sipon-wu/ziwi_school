// 知识边界 · 精简版验收测试
const { chromium } = require('playwright');
const http = require('http');
const { execSync } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function apiPost(path, body) {
  return new Promise((resolve) => {
    const BASE = 'http://school1.ziwi.cn';
    const url = new URL(path, BASE);
    const data = JSON.stringify(body);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000,
    };
    const req = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, data: buf }); }
      });
    });
    req.on('error', e => resolve({ status: 0, data: 'FAIL: ' + e.message }));
    req.write(data);
    req.end();
  });
}

function sshRun(code) {
  const cmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@193.112.163.147 'cat <<'"'"'EOF'"'"' | docker exec -i zhiwei-ai-staging python3\n${code}\nEOF' 2>/dev/null`;
  return execSync(cmd, { timeout: 60000, encoding: 'utf8', shell: '/bin/bash' });
}

(async () => {
  const results = [];
  const record = (area, item, status, detail) => {
    results.push({ area, item, status, detail });
    const tag = status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL';
    console.log(`[${tag}] ${area} / ${item} :: ${detail.slice(0, 200)}`);
  };

  console.log('=== 1. API 检索 ===');

  let r = await apiPost('/api/ai/rag/search', { query: '分数的意义', filters: { subject: '数学', grade: '五年级' }, top_k: 3 });
  let hits = (r.data?.results || r.data?.hits || []);
  record('rag/search', '数学-五年级-分数', r.status === 200 && hits.length >= 1 ? 'PASS' : 'FAIL', `status=${r.status} hits=${hits.length}`);

  r = await apiPost('/api/ai/rag/search', { query: 'What time is it', filters: { subject: '英语', grade: '四年级' }, top_k: 2 });
  hits = (r.data?.results || r.data?.hits || []);
  record('rag/search', '英语-四年级', r.status === 200 && hits.length >= 1 ? 'PASS' : 'FAIL', `status=${r.status} hits=${hits.length}`);

  r = await apiPost('/api/ai/rag/search', { query: '小数乘法', filters: { subject: '数学', grade: '五年级', unit: '1　小数乘法' }, top_k: 2 });
  hits = (r.data?.results || r.data?.hits || []);
  record('rag/search', '含unit过滤', r.status === 200 && hits.length >= 1 ? 'PASS' : 'FAIL', `status=${r.status} hits=${hits.length}`);

  r = await apiPost('/api/ai/rag/search', { query: '分数的意义', top_k: 2 });
  hits = (r.data?.results || r.data?.hits || []);
  record('rag/search', '无过滤(全量)', r.status === 200 && hits.length >= 1 ? 'PASS' : 'FAIL', `status=${r.status} hits=${hits.length}`);

  console.log('\n=== 2. courseware/validate 发布校验 ===');

  r = await apiPost('/api/ai/courseware/validate', { markdown: '# 分数的意义\n正常内容', subject: '数学', grade: '五年级' });
  record('courseware/validate', '正常课件通过', r.status === 200 && r.data?.passed !== false ? 'PASS' : 'FAIL', `status=${r.status} blocked=${r.data?.blocked} passed=${r.data?.passed}`);

  r = await apiPost('/api/ai/courseware/validate', { markdown: '# 麦当劳的数学\n汉堡每个15元', subject: '数学', grade: '三年级' });
  record('courseware/validate', '负面符号阻止', r.status === 200 && r.data?.blocked === true ? 'PASS' : 'FAIL', `status=${r.status} blocked=${r.data?.blocked}`);

  console.log('\n=== 3. courseware/consult 课前问诊 ===');

  r = await apiPost('/api/ai/courseware/consult', { subject: '数学', grade: '五年级', lesson_title: '分数的意义', knowledge_points: ['分数的意义'] });
  const qs = (r.data?.questions || []);
  record('courseware/consult', '返回问诊问题', r.status === 200 && qs.length > 0 ? 'PASS' : 'FAIL', `status=${r.status} questions=${qs.length}`);

  console.log('\n=== 4. retrieve_boundary 容器内检索 ===');

  const bTests = [
    { label: '数学-五年级-人教版-分数', code: 'from vector_store import retrieve_boundary; from embeddings import embed_texts; q=embed_texts(["分数的意义"])[0]; r=retrieve_boundary(q, subject="数学", grade="五年级", version="人教版", unit="4 分数的意义和性质", extend=True, top_k=3); print("HITS="+str(len(r))); [print("  sim="+str(round(x.get("similarity",0),3))+" unit="+(x.get("unit","") or "")[:20]) for x in r]' },
    { label: '英语-PEP-无unit', code: 'from vector_store import retrieve_boundary; from embeddings import embed_texts; q=embed_texts(["What time is it"])[0]; r=retrieve_boundary(q, subject="英语", grade="四年级", version="PEP", unit="", extend=False, top_k=3); print("HITS="+str(len(r))); [print("  sim="+str(round(x.get("similarity",0),3))+" unit="+(x.get("unit","") or "")[:20]) for x in r]' },
    { label: '语文-部编版-观潮', code: 'from vector_store import retrieve_boundary; from embeddings import embed_texts; q=embed_texts(["观潮"])[0]; r=retrieve_boundary(q, subject="语文", grade="四年级", version="部编版", unit="第一单元", extend=True, top_k=2); print("HITS="+str(len(r))); [print("  sim="+str(round(x.get("similarity",0),3))+" unit="+(x.get("unit","") or "")[:20]) for x in r]' },
  ];
  for (const t of bTests) {
    try {
      const out = sshRun(t.code);
      const ok = /HITS=[1-9]/.test(out);
      const line = out.split('\n').filter(l => l.includes('HITS='))[0] || 'no HITS';
      record('retrieve_boundary', t.label, ok ? 'PASS' : 'FAIL', line.trim() + ' ' + (out.match(/sim=[\d.]+/g) || []).slice(0,3).join(', '));
    } catch(e) {
      record('retrieve_boundary', t.label, 'FAIL', String(e.message || e).slice(0,150));
    }
  }

  console.log('\n=== 5. 分区表基础状态 ===');

  try {
    const out = execSync(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@193.112.163.147 'docker exec zhiwei-postgres-staging psql -U zhiwei -d zhiwei_staging -t -c "SELECT count(*) FROM pg_class WHERE relname ~ '"'"'tb_lesson_source_p[0-9]{2}'"'"' AND relkind='"'"'r'"'"';" 2>/dev/null'`, { timeout: 15000, encoding: 'utf8', shell: '/bin/bash' });
    const num = out.trim();
    record('infra', '分区数', num === '32' ? 'PASS' : 'FAIL', `shards=${num}`);
  } catch(e) {
    record('infra', '分区数', 'FAIL', String(e).slice(0,100));
  }

  try {
    const out = execSync(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 root@193.112.163.147 'docker exec zhiwei-postgres-staging psql -U zhiwei -d zhiwei_staging -t -c "SELECT count(*) FROM tb_lesson_source;" 2>/dev/null'`, { timeout: 15000, encoding: 'utf8', shell: '/bin/bash' });
    const n = parseInt(out.trim(), 10);
    record('infra', '数据行数', n >= 49000 ? 'PASS' : 'FAIL', `rows=${n}`);
  } catch(e) {
    record('infra', '数据行数', 'FAIL', String(e).slice(0,100));
  }

  console.log('\n=== 6. 前端浏览器测试 ===');

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE_ERROR: ' + msg.text().slice(0,100)); });

  // 登录
  await page.goto('http://school1.ziwi.cn/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.fill('input[placeholder="请输入手机号"]', '13800000002');
  await page.fill('input[placeholder="请输入密码"]', 'teacher123');
  await page.click('button[type=submit]');
  await sleep(3000);
  const loginOk = !page.url().includes('/login');
  record('frontend', '登录', loginOk ? 'PASS' : 'FAIL', `url=${page.url().slice(0,60)} pageErrors=${errors.filter(e => e.includes('PAGE_ERROR')).length}`);

  // 遍历页面
  const pages = [
    { name: '素材页(课件)', url: '/materials' },
    { name: '教案页', url: '/lesson-plans' },
    { name: '出题页', url: '/exercises' },
    { name: '试卷库页', url: '/exams' },
  ];
  for (const p of pages) {
    const before = errors.length;
    await page.goto('http://school1.ziwi.cn' + p.url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await sleep(2000);
    let visible = false, appErr = false;
    try {
      const txt = await page.evaluate(() => document.body ? document.body.innerText : '');
      visible = txt.length > 20;
      appErr = /Application error/i.test(txt);
    } catch {}
    const redirected = page.url().includes('/login');
    const ok = visible && !appErr && !redirected;
    record('frontend', p.name, ok ? 'PASS' : 'FAIL', `visible=${visible} appErr=${appErr} redirect=${redirected} newErrors=${errors.length - before}`);
  }

  // 整体错误评估
  const pageCrashes = errors.filter(e => e.includes('PAGE_ERROR'));
  const notFound = errors.filter(e => e.includes('404:'));
  record('frontend', '无页面崩溃', pageCrashes.length === 0 ? 'PASS' : 'FAIL', `pageErrors=${pageCrashes.length}`);
  record('frontend', '无404泄漏', notFound.length === 0 ? 'PASS' : 'FAIL', `404s=${notFound.length}`);

  await browser.close();

  // 汇总
  console.log('\n══════════════════════════════════');
  const pass = results.filter(r => r.status === 'PASS').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log(`总计: ${results.length}  PASS=${pass}  WARN=${warn}  FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})();
