const B = 'http://school1.ziwi.cn'
const post = (u, b, t) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (t || '') }, body: JSON.stringify(b) }).then(r => r.json())
const getRaw = (u, t) => fetch(B + u, { headers: { Authorization: 'Bearer ' + (t || '') } })
const del = (u, t) => fetch(B + u, { method: 'DELETE', headers: { Authorization: 'Bearer ' + (t || '') } }).then(r => r.status)

;(async () => {
  const L = await post('/api/auth/login', { phone: '13800000002', password: 'teacher123' })
  const t = L.token
  let archived = 0
  for (let round = 0; round < 20; round++) {
    const list = await (await getRaw('/api/lesson-plans', t)).json()
    const items = list.items || []
    if (items.length === 0) break
    for (const p of items) {
      const s = await del('/api/lesson-plans/' + p.id, t)
      if (s === 200) archived++
    }
  }
  const finalList = await (await getRaw('/api/lesson-plans', t)).json()
  console.log('archived total:', archived, '| remaining in list:', (finalList.items || []).length)
})().catch(e => console.log('ERR', e.message))
