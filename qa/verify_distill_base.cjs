#!/usr/bin/env node
// 蒸馏底座回归断言（知微·有谱引擎 RAG 素材层）
// ─────────────────────────────────────────────────────────────
// 根治"假绿"：原 api_regress 只覆盖业务 HTTP 路径，从不验证蒸馏底座
// 「有料」——导致 staging 野灌、prod 建不出表时，测试全绿却线上无检索素材。
//
// 本脚本直连两环境 postgres 容器，断言：
//   1) tb_lesson_source 行数 ≥ 下限阈值（底座已灌）
//   2) tb_lesson_lecture 行数 ≥ 下限阈值（讲义蒸馏产物已灌）
//   3) source.lecture_id 外键悬空数 = 0（数据引用完整）
//
// 运行（需在能 SSH 到 CVM 193.112.163.147 的机器上）：
//   SSH_HOST=193.112.163.147 node qa/verify_distill_base.cjs
//   SSH_HOST=193.112.163.147 THRESH_SOURCE=50000 THRESH_LECTURE=200 node qa/verify_distill_base.cjs
//
// 退出码：全部 PASS=0，任一 FAIL=1（供 CI 拦截）。
// 注：阈值用下限而非精确值，允许日后正常增量灌数据不致假红。
// ─────────────────────────────────────────────────────────────
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SSH_HOST = process.env.SSH_HOST || '193.112.163.147';
const SSH_USER = process.env.SSH_USER || 'root';
const THRESH_SOURCE = parseInt(process.env.THRESH_SOURCE || '50000', 10);
const THRESH_LECTURE = parseInt(process.env.THRESH_LECTURE || '200', 10);

// 环境 → { 容器名, 库名 }
const ENVS = [
  { name: 'staging', container: 'zhiwei-postgres-staging', db: 'zhiwei_staging' },
  { name: 'prod',    container: 'zhiwei-postgres-prod',    db: 'zhiwei' },
];

// 在容器内用 psql 查单行数值（抑制 collation 警告到 /dev/null）
function psqlCount(container, db, sql) {
  const remote = `docker exec ${container} psql -U zhiwei -d ${db} -tAc "${sql}" 2>/dev/null`;
  const out = execFileSync('ssh', [
    '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=15',
    `${SSH_USER}@${SSH_HOST}`, remote,
  ], { encoding: 'utf8' });
  const n = parseInt(String(out).trim().split('\n')[0], 10);
  return Number.isFinite(n) ? n : -1;
}

const results = [];
function rec(name, env, metric, actual, pass, note) {
  results.push({ name: `${name}-${env}`, env, metric, actual, pass, note: note || '' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}-${env}  ${metric} = ${actual}${pass ? '' : '  ⚠ ' + (note || '')}`);
}

for (const e of ENVS) {
  const sourceN = psqlCount(e.container, e.db, 'SELECT COUNT(*) FROM tb_lesson_source');
  const lectureN = psqlCount(e.container, e.db, 'SELECT COUNT(*) FROM tb_lesson_lecture');
  const orphanN = psqlCount(
    e.container, e.db,
    `SELECT COUNT(*) FROM tb_lesson_source s LEFT JOIN tb_lesson_lecture l ON s.lecture_id=l.id WHERE s.lecture_id IS NOT NULL AND l.id IS NULL`
  );

  rec('DISTILL-SOURCE', e.name, 'tb_lesson_source rows', sourceN, sourceN >= THRESH_SOURCE,
    `期望 ≥ ${THRESH_SOURCE}`);
  rec('DISTILL-LECTURE', e.name, 'tb_lesson_lecture rows', lectureN, lectureN >= THRESH_LECTURE,
    `期望 ≥ ${THRESH_LECTURE}`);
  rec('DISTILL-ORPHAN', e.name, 'source.lecture_id 外键悬空', orphanN, orphanN === 0,
    '期望 = 0');
}

const passN = results.filter(r => r.pass).length;
const failN = results.length - passN;
console.log(`\n==== 蒸馏底座回归: ${passN} PASS / ${failN} FAIL / 共 ${results.length} ====`);
const report = {
  generated: new Date().toISOString(),
  ssh_host: SSH_HOST,
  thresholds: { source: THRESH_SOURCE, lecture: THRESH_LECTURE },
  total: results.length, pass: passN, fail: failN, cases: results,
};
fs.writeFileSync(path.join(__dirname, 'verify_distill_base_report.json'), JSON.stringify(report, null, 2));
console.log('报告已写: qa/verify_distill_base_report.json');
process.exit(failN === 0 ? 0 : 1);
