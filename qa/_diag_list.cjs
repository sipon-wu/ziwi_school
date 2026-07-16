const B = 'http://school1.ziwi.cn'
const post = (u, b, t) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (t || '') }, body: JSON.stringify(b) }).then(r => r.json())
const getRaw = (u, t) => fetch(B + u, { headers: { Authorization: 'Bearer ' + (t || '') } })
const del = (u, t) => fetch(B + u, { method: 'DELETE', headers: { Authorization: 'Bearer ' + (t || '') } }).then(r => r.status)

;(async () => {
  const L = await post('/api/auth/login', { phone: '13800000002', password: 'teacher123' })
  const t = L.token
  const list = await (await getRaw('/api/lesson-plans', t)).json()
  const items = list.items || []
  console.log('before count:', items.length, 'statuses:', JSON.stringify([...new Set(items.map(p => p.status))]))
  const one = items[0]
  await del('/api/lesson-plans/' + one.id, t)
  const list2 = await (await getRaw('/api/lesson-plans', t)).json()
  const items2 = list2.items || []
  const statuses2 = [...new Set(items2.map(p => p.status))]
  console.log('after count:', items2.length, 'statuses:', JSON.stringify(statuses2))
  console.log('archived present in list?', items2.some(p => p.status === 'archived'))
})().catch(e => console.log('ERR', e.message))
