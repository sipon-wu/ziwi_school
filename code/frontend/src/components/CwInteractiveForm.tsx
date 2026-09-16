/**
 * 互动组件编辑表单（2026-09-16 从 CoursewareBuilder.tsx 移出，抽组件第一步）
 *
 * 原本是页面文件里的**模块级函数 + 组件**（共 128 行），与课件编辑器主流程无耦合：
 * 只依赖 `H5Component` 这一个类型。移出后 CoursewareBuilder 少 128 行、少 3 个符号。
 *
 * 组件本身是"受控表单"：值由父层（按页的互动列表）持有，改动通过 onChange 冒泡，
 * 因此移出时**无需任何行为变更**，连 props 签名都没动。
 */
import type { H5Component } from '../lib/exportPptx'

/** 互动组件的一句话摘要（列表收起态显示） */
export function interactiveSummary(it: H5Component): string {
  switch (it.type) {
    case 'reveal': return it.prompt || it.answer || '点击揭示'
    case 'quiz': return it.question || '选择题'
    case 'audio': return it.title || it.src || '音频'
    case 'video': return it.title || it.src || '视频'
    case 'gallery': return `图册(${(it.images || []).length}张)`
    case 'popup': return it.triggerText || '弹层'
    case 'readalong': return `点读(${(it.sentences || []).length}句)`
    case 'drawing': return it.title || '绘图白板'
    default: return '互动组件'
  }
}

/** 按类型给出一份可直接编辑的初始互动组件（新建时挂到当前页） */
export function defaultInteractive(type: H5Component['type']): H5Component {
  switch (type) {
    case 'reveal': return { type: 'reveal', prompt: '点击揭示：教师讲解要点', answer: '' }
    case 'quiz': return { type: 'quiz', question: '', options: ['', ''], correct: 0 }
    case 'audio': return { type: 'audio', src: '', title: '' }
    case 'video': return { type: 'video', src: '' }
    case 'gallery': return { type: 'gallery', images: [''], direction: 'h' }
    case 'popup': return { type: 'popup', triggerText: '查看拓展', content: '' }
    case 'readalong': return { type: 'readalong', sentences: [{ text: '', src: '' }] }
    case 'drawing': return { type: 'drawing', title: '现场绘图区', prompt: '' }
  }
}

export function InteractiveForm({ value, onChange, locked }: { value: H5Component; onChange: (it: H5Component) => void; locked: boolean }) {
  if (locked) return <div className="text-[11px] text-[#9A9A9A] px-1 py-2">已发布定版，互动不可编辑（可重新编辑草稿）</div>
  const upd = (patch: Partial<H5Component>) => onChange({ ...value, ...patch } as H5Component)
  const field = 'w-full px-2 py-1 text-[12px] border border-[#E7E7EB] rounded focus:border-[#02A7F0] outline-none'
  const label = 'block text-[11px] text-[#595959] mb-1 mt-2'
  switch (value.type) {
    case 'reveal':
      return (
        <div>
          <label className={label}>引导语（可选）</label>
          <input className={field} value={value.prompt || ''} onChange={e => upd({ prompt: e.target.value })} placeholder="如：点击揭示答案" />
          <label className={label}>答案内容</label>
          <textarea className={field} rows={2} value={value.answer} onChange={e => upd({ answer: e.target.value })} placeholder="点击后显示的内容" />
        </div>
      )
    case 'quiz':
      return (
        <div>
          <label className={label}>题干</label>
          <input className={field} value={value.question} onChange={e => upd({ question: e.target.value })} placeholder="如：下列哪个是…" />
          <label className={label}>选项（每项）</label>
          {value.options.map((o, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input className={field} value={o} onChange={e => { const ns = value.options.slice(); ns[i] = e.target.value; upd({ options: ns }) }} placeholder={`选项 ${i + 1}`} />
              <button className={`px-2 text-[11px] rounded ${value.correct === i ? 'bg-[#0a7c2e] text-white' : 'bg-[#F0F2F5] text-[#595959]'}`} onClick={() => upd({ correct: i })}>正确</button>
            </div>
          ))}
          <button className="text-[11px] text-[#02A7F0] mt-1" onClick={() => upd({ options: [...value.options, ''] })}>+ 选项</button>
        </div>
      )
    case 'audio':
      return (
        <div>
          <label className={label}>音频标题（可选）</label>
          <input className={field} value={value.title || ''} onChange={e => upd({ title: e.target.value })} />
          <label className={label}>音频 URL（/uploads/xxx 或完整 http(s)）</label>
          <input className={field} value={value.src} onChange={e => upd({ src: e.target.value })} placeholder="/uploads/xxx.mp3 或 https://…" />
        </div>
      )
    case 'video':
      return (
        <div>
          <label className={label}>视频 URL（/uploads/xxx 或完整 http(s)）</label>
          <input className={field} value={value.src} onChange={e => upd({ src: e.target.value })} placeholder="/uploads/xxx.mp4 或 https://…" />
        </div>
      )
    case 'gallery':
      return (
        <div>
          <label className={label}>方向</label>
          <div className="flex gap-2 mb-1">
            <button className={`px-2 text-[11px] rounded ${value.direction !== 'v' ? 'bg-[#02A7F0] text-white' : 'bg-[#F0F2F5] text-[#595959]'}`} onClick={() => upd({ direction: 'h' })}>横向滑动</button>
            <button className={`px-2 text-[11px] rounded ${value.direction === 'v' ? 'bg-[#02A7F0] text-white' : 'bg-[#F0F2F5] text-[#595959]'}`} onClick={() => upd({ direction: 'v' })}>纵向滑动</button>
          </div>
          <label className={label}>图片 URL（每行一项）</label>
          {value.images.map((img, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input className={field} value={img} onChange={e => { const ns = value.images.slice(); ns[i] = e.target.value; upd({ images: ns }) }} placeholder="/uploads/xxx.png" />
              {value.images.length > 1 && <button className="px-2 text-[11px] text-red-400" onClick={() => upd({ images: value.images.filter((_, k) => k !== i) })}>✕</button>}
            </div>
          ))}
          <button className="text-[11px] text-[#02A7F0] mt-1" onClick={() => upd({ images: [...value.images, ''] })}>+ 图片</button>
        </div>
      )
    case 'popup':
      return (
        <div>
          <label className={label}>触发按钮文字</label>
          <input className={field} value={value.triggerText} onChange={e => upd({ triggerText: e.target.value })} />
          <label className={label}>弹层内容</label>
          <textarea className={field} rows={3} value={value.content} onChange={e => upd({ content: e.target.value })} />
        </div>
      )
    case 'readalong':
      return (
        <div>
          <label className={label}>句子（按标点断句，每句绑定音频；点击句子播放）</label>
          {value.sentences.map((s, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input className={`${field} flex-1`} value={s.text} onChange={e => { const ns = value.sentences.slice(); ns[i] = { ...ns[i], text: e.target.value }; upd({ sentences: ns }) }} placeholder="句子文字" />
              <input className={`${field} flex-1`} value={s.src} onChange={e => { const ns = value.sentences.slice(); ns[i] = { ...ns[i], src: e.target.value }; upd({ sentences: ns }) }} placeholder="音频 URL" />
              {value.sentences.length > 1 && <button className="px-2 text-[11px] text-red-400" onClick={() => upd({ sentences: value.sentences.filter((_, k) => k !== i) })}>✕</button>}
            </div>
          ))}
          <button className="text-[11px] text-[#02A7F0] mt-1" onClick={() => upd({ sentences: [...value.sentences, { text: '', src: '' }] })}>+ 句子</button>
        </div>
      )
    case 'drawing':
      return (
        <div>
          <label className={label}>绘图区标题（可选）</label>
          <input className={field} value={value.title || ''} onChange={e => upd({ title: e.target.value })} placeholder="如：对话气泡图 / 句型结构树" />
          <label className={label}>绘制说明（投屏白板提示教师画什么）</label>
          <textarea className={field} rows={2} value={value.prompt || ''} onChange={e => upd({ prompt: e.target.value })} placeholder="如：画出 A/B 两个角色的气泡，填入本课重点句型" />
          <p className="text-[10px] text-[#9A9A9A] mt-1">预览/导出后该页会出现可书写的投屏白板，教师可现场手绘。</p>
        </div>
      )
    default:
      return null
  }
}
