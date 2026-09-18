/**
 * 课件 e2e「基线件」自建工具（2026-09-18）
 *
 * 背景：staging 存量课件已按用户指令清空，守卫不能再依赖既有数据 —— 改为**随用随建**：
 *   先按 (name, format) 查找，找不到就用 POST /api/materials/json 建一份最小可用课件。
 *
 * ⚠ 后端无 `DELETE /api/materials/:id`（materials 只有 GET/POST/PUT），故建出的基线件会留在 staging。
 *   命名统一前缀 `__E2E基线_`，便于识别与人工清理（SQL：DELETE FROM materials WHERE name LIKE '__E2E基线_%'）。
 */
const B = process.env.BASE || 'http://school1.ziwi.cn'
const PHONE = process.env.PHONE || '13800000002'
const PASS = process.env.PASS || 'teacher123'

const PPT_NAME = '__E2E基线_课件'
const H5_NAME = '__E2E基线_H5课件'

const b64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')

/** PPT 基线件内容：封面（H1）+ 学习目标 + 课堂练习（含 CW-EL 四个**界内**文本框，供画布守卫注入越界用例）
 *  + 自证_封面版式（layout:edu-cover + CW-EL 标记元素，供 verify_cover_elements 守三端一致） */
const COVER_MARK = '封面自证元素'
function pptContent() {
  const els = [0, 1, 2, 3].map((i) => ({
    id: 'el_fx_' + i,
    type: 'text',
    x: 3 + i * 24,   // 3 / 27 / 51 / 75（+w22 → 最右 97，界内）
    y: 24,
    w: 22,
    h: 64,
    text: '要点' + (i + 1),
    fontSize: 20,
    color: '353535',
    bullet: true,
  }))
  const coverEls = [{ id: 'el_fx_cover', type: 'text', x: 12, y: 66, w: 76, h: 12, text: COVER_MARK, fontSize: 18, color: 'FFFFFF', align: 'center' }]
  return [
    '# 天窗',
    '',
    '## 学习目标',
    '- 认识生字',
    '- 有感情地朗读课文',
    '',
    '## 课堂练习',
    '<!-- CW-EL:' + b64(els) + ' -->',
    '',
    '- 找一找，哪一句写出天窗是唯一的慰藉',
    '',
    '## 自证_封面版式',
    '<!-- layout: edu-cover -->',
    '<!-- CW-EL:' + b64(coverEls) + ' -->',
    '',
  ].join('\n')
}

/** H5 基线件内容：极简绘本（mdToStory 会自动合成封面场景，故 2 个场景即可满足"≥2 幕 + 首屏封面"） */
function h5Content() {
  return [
    '# 天窗',
    '> 学科: 语文',
    '> 年级: 四年级',
    '',
    '## 场景一',
    '天窗是唯一的慰藉。',
    '',
    '## 场景二',
    '雨脚卜落卜落跳，带子似的闪电一瞥。',
    '',
  ].join('\n')
}

async function session() {
  const lg = await (await fetch(B + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: PASS }),
  })).json()
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg.token }
  const get = async (p) => (await (await fetch(B + p, { headers: H })).json())
  const put = async (p, body) => fetch(B + p, { method: 'PUT', headers: H, body: JSON.stringify(body) })
  return { lg, H, get, put }
}

/** 保证基线件存在；返回 { id, content, format, name, created } */
async function ensureCourseware({ name, format, content, h5_html = '', subject = '语文', grade = '四年级' }) {
  const { H, get } = await session()
  const all = (await get('/api/materials')).items || []
  const hit = all.find((x) => String(x.name) === name && String(x.format) === format)
  if (hit) {
    // 内容漂移复位（上一轮测试回滚残留 / fixture 升级）→ 保证用例可复现（不改 status，避免打断发布态用例）
    const cur = await get(`/api/materials/${hit.id}`)
    if (String(cur.content || '') !== String(content)) {
      await fetch(B + `/api/materials/${hit.id}`, { method: 'PUT', headers: H, body: JSON.stringify({ ...cur, content }) })
      return { id: hit.id, content, format, name, created: false, synced: true }
    }
    return { id: hit.id, content: cur.content, format, name, created: false }
  }
  const r = await fetch(B + '/api/materials/json', {
    method: 'POST', headers: H,
    body: JSON.stringify({ name, type: 'courseware', format, content, h5_html, status: 'draft', subject, grade }),
  })
  const m = await r.json()
  if (!m || !m.id) throw new Error(`建基线件失败（${format}）：${JSON.stringify(m).slice(0, 200)}`)
  return { id: m.id, content: m.content, format, name, created: true }
}

/** PPT 基线件（含课堂练习页与 CW-EL） */
const ensurePptFixture = () => ensureCourseware({ name: PPT_NAME, format: 'ppt', content: pptContent() })

/** H5 基线件（正文 markdown；h5_html 由调用方用 markdownToStorybookH5 生成后回写，保证快照与内容同源） */
const ensureH5Fixture = () => ensureCourseware({ name: H5_NAME, format: 'h5', content: h5Content() })

module.exports = {
  B, PPT_NAME, H5_NAME, COVER_MARK,
  pptContent, h5Content, session,
  ensureCourseware, ensurePptFixture, ensureH5Fixture,
}
