// 黄金清单一致性断言（前端端）。运行：npx tsx code/shared/subjects.golden.test.ts
// 任何与 subjects.golden.json 的分叉都将抛出并 FAIL。
import * as fs from 'fs'
import * as path from 'path'
import {
  ALL_SUBJECTS,
  SUBJECT_CODES,
  isBoundarySubject,
  subjectsForGrade,
  SUBJECTS_BY_LEVEL,
} from './subjects'

const golden = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'subjects.golden.json'), 'utf-8'),
) as {
  standard_subjects: string[]
  raw_to_standard: Record<string, string>
}

let failures = 0
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  } else {
    console.log('PASS:', msg)
  }
}

// 1) 标准学科序一致
check(
  JSON.stringify(ALL_SUBJECTS) === JSON.stringify(golden.standard_subjects),
  'ALL_SUBJECTS 与黄金清单 standard_subjects 一致',
)

// 2) 边界判定与黄金清单一致
//    - 归一结果为空 → 原始名必须被识别为非边界（已剔除）
//    - 归一结果非空 → 必须是黄金清单中登记的合法值（边界学科 或 合科标记如"科学"）
const legalValues = new Set(
  Object.values(golden.raw_to_standard).filter((v) => v !== ''),
)
for (const [raw, expect] of Object.entries(golden.raw_to_standard)) {
  if (expect === '') {
    check(!isBoundarySubject(raw), `前端剔除边界外原始名 "${raw}"`)
  } else {
    check(
      legalValues.has(expect),
      `归一结果 "${expect}"（来自 "${raw}"）是黄金清单登记的合法值`,
    )
  }
}

// 3) 最严格负向：艺体/信息科技/未知学科必须被边界判定拒掉（防漏网）
const rejected = ['音乐', '美术', '体育', '信息技术', '信息科技', '劳动', '综合实践', '人工智能', '未知学科X', ' 语文', '语文 ']
for (const raw of rejected) {
  check(!isBoundarySubject(raw), `边界判定拒掉非边界学科 "${raw}"`)
}

// 4) 学段学科严格子集校验：任一年级返回的学科必须是 9 标准学科的子集，且不含艺体/信息
const allStandard = new Set(golden.standard_subjects)
const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
for (const g of grades) {
  const subs = subjectsForGrade(g)
  for (const s of subs) {
    check(allStandard.has(s), `年级${g} 学科 "${s}" 属于 9 标准学科`)
  }
  if (g <= 6) {
    const noAdv = !subs.some((s) => ['物理', '化学', '生物', '历史', '地理'].includes(s))
    check(noAdv, `小学年级${g} 不出现中学专属学科`)
  }
  if (g >= 7) {
    const hasAll = allStandard.size === subs.length && subs.every((s) => allStandard.has(s))
    check(hasAll, `中学年级${g} 应含全部 9 边界学科`)
  }
}
for (const [lvl, subs] of Object.entries(SUBJECTS_BY_LEVEL)) {
  for (const s of subs) {
    check(allStandard.has(s), `SUBJECTS_BY_LEVEL[${lvl}] 学科 "${s}" 属于 9 标准学科`)
  }
}

if (failures > 0) {
  console.error(`\n黄金清单断言失败：${failures} 项`)
  process.exit(1)
}
console.log('\n黄金清单前端端全绿 ✅')
