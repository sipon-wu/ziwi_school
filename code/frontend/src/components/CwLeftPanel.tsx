/**
 * 课件编辑器左栏（生成参数表单）（2026-09-16 从 CoursewareBuilder.tsx 抽出，抽组件 Step 3）
 *
 * 这是编辑器左栏整张生成表单：课题名称 / 来源（诊断态）/ 场景化快捷模板 / 课件风格 /
 * 参照课件 / 知识点范围 / 附加要求 / 发散度 / 边缘知识 / 课前问诊 / 生成按钮。
 * 同一份 JSX 在页面里被 4 处引用（非全屏的 primaryLeft+secondaryLeft、全屏的两者）。
 *
 * ★ props 怎么压到 11 个的
 *   这块表单读写的绝大多数是**生成参数**，而它们正是 `useCwGenParams()` 的返回值
 *   （genTitle / genStyleTag / motifTags / cwExtra / genBaseId / divergenceLevel / edge 系列 / consult 系列 等 19 个）。
 *   逐个传会变成 30+ 个 props 的怪物，故把整个 hook 返回值当一个 `gen` 对象传进来。
 *   （同理把生成态归成 genState。）这样既保持显式，又不至于 prop 地狱。
 *
 * 拆分原则（同前几步）：行为逐行搬迁，不改逻辑、不改视觉。
 */
import { Loader2, Sparkles } from 'lucide-react'
import EditorInfoPanel from './EditorInfoPanel'
import { useToast } from './Toast'
import { STYLE_LABELS, type StyleTag } from '../lib/cwTemplate'
import { isDebugView } from '../lib/debugFlag'
import type { ScopeResolvedPayload, SimilarMaterial } from '../lib/domain'
import type { UseKnowledgePickerReturn } from '../hooks/useKnowledgePicker'
import type { useCwGenParams } from '../hooks/useCwGenParams'
import type { useTeaching } from '../lib/TeachingContext'
import type React from 'react'

export interface CwLeftPanelProps {
  /** 生成参数（useCwGenParams() 的返回值整体传入，见文件头说明） */
  gen: ReturnType<typeof useCwGenParams>
  /** 生成态与生成动作 */
  genState: {
    loading: boolean
    stage: { stage: string; message: string } | null
    similar: SimilarMaterial | null
    onGenerate: () => void
  }
  /** 当前模式：仅 AI 模式显示「生成课件」按钮 */
  workMode: 'ai' | 'doc'
  teaching: ReturnType<typeof useTeaching>
  gradeName: string
  classLabel: string
  picker: UseKnowledgePickerReturn
  /** 参照课件候选（左栏只渲染 id / name，故按实际收窄，不要求完整 MaterialItem） */
  materials: Array<{ id: string; name: string }>
  scopeResolved: ScopeResolvedPayload | null
  /** 提纲页数（cwOutline.length），用于按钮文案「重新生成」vs「AI 生成」 */
  pageCount: number
  /** 小微「应用到当前内容」 */
  onLeftApply: NonNullable<React.ComponentProps<typeof EditorInfoPanel>['xiaowei']>['onApply']
}

export function CwLeftPanel({
  gen, genState, workMode, teaching, gradeName, classLabel, picker,
  materials, scopeResolved, pageCount, onLeftApply,
}: CwLeftPanelProps) {
  const { toast } = useToast()
  const {
    genTitle, setGenTitle, genStyleTag, setGenStyleTag, genStyleProfile, setGenStyleProfile,
    motifTags, cwExtra, setCwExtra, genBaseId, setGenBaseId,
    divergenceLevel, setDivergenceLevel, edgeEnabled, setEdgeEnabled, edgeCats, setEdgeCats,
    consultQuestions, consultAnswers, setConsultAnswers,
  } = gen
  const { loading: genLoading, stage: genStage, similar: cwSimilar, onGenerate: handleGenCourseware } = genState

  return (
    <EditorInfoPanel
      showBasicInfo
      showGrade
      classLabel={classLabel || undefined}
      xiaowei={{
        contextType: 'courseware',
        subject: teaching.subject,
        grade: gradeName,
        knowledgeNodeNames: picker.selectedNodes.map((n: any) => n.name),
        extraRequirements: cwExtra,
        onApply: onLeftApply,
      }}
    >
      {/* 频道由主导航「教学课件」分组入口分流，进入后不再在左栏切换 */}
      {/* 课题名称 */}
      <div className="px-5 py-3">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">课题名称 <span className="text-red-500">*</span></label>
        <input value={genTitle} onChange={e => setGenTitle(e.target.value)} placeholder="如：光的折射定律"
          className="w-full px-3 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
      </div>

      {/* ── 来源（只读溯源，2026-09-13；2026-09-15 **默认隐藏**）──
          它回答的是"这份课件是按什么生成的"：知识面来源 teacher|kg、前置来源 qian_zhi|parent_id、
          发散边界 orbit/edge/beyond_band、生成模型 qwen-plus —— 全是研发/QA 语汇，
          教师看不懂也帮不上忙（教师原话："这是啥，应该隐藏的吧"；PPT/H5 两处都有）。
          故改为**诊断开关后才显示**（`?debug=1` 或 localStorage `zhiwei_debug=1`，见 lib/debugFlag.ts），
          保留代码是为了复现缺陷时能一眼看到当时的生成配方。 */}
      {isDebugView() && (() => {
        const sr = scopeResolved?.scope_resolved
        if (!sr) return null
        const srcLabel = sr.source === 'teacher' ? '教师锚定'
          : sr.source === 'kg' ? '系统按知识图谱边界' : '未指定'
        const preLabel = sr.prereq_source === 'qian_zhi' ? '前置链'
          : sr.prereq_source === 'parent_id' ? '父节点一级兜底'
            : sr.prereq_source === 'frontend' ? '前端直传' : '无'
        const dv = sr.divergence || {}
        const kps: string[] = sr.knowledge_points || []
        const tbv = scopeResolved?.textbook_version_name || ''
        const row = 'flex gap-1 text-[11px] leading-relaxed'
        return (
          <div className="px-5 py-3 border-t border-[#F0F0F0] bg-[#FAFBFC]">
            <label className="block text-[12px] font-medium text-[#353535] mb-2">
              来源
              <span className="ml-1 text-[10px] font-normal text-[#9A9A9A]">只读 · 这份课件是按什么生成的</span>
            </label>
            <div className="space-y-1">
              <div className={row}>
                <span className="shrink-0 text-[#9A9A9A] w-14">知识面</span>
                <span className="text-[#353535]">{srcLabel}
                  {kps.length > 0 && <span className="text-[#9A9A9A]">（{kps.slice(0, 5).join('、')}{kps.length > 5 ? '…' : ''}）</span>}
                </span>
              </div>
              <div className={row}>
                <span className="shrink-0 text-[#9A9A9A] w-14">前置来源</span>
                <span className="text-[#353535]">{preLabel}</span>
              </div>
              <div className={row}>
                <span className="shrink-0 text-[#9A9A9A] w-14">发散边界</span>
                <span className="text-[#353535]">{dv.label || dv.level || '—'}
                  <span className="text-[#9A9A9A]">（跨界 {dv.orbit ?? '—'} / 边缘 {dv.edge ?? '—'} / {dv.beyond_band ? '允许 ±1 档外' : '不超 ±1 档'}）</span>
                </span>
              </div>
              {(tbv || sr.unit) && (
                <div className={row}>
                  <span className="shrink-0 text-[#9A9A9A] w-14">教材</span>
                  <span className="text-[#353535]">{[tbv, sr.unit].filter(Boolean).join(' · ')}</span>
                </div>
              )}
              <div className={row}>
                <span className="shrink-0 text-[#9A9A9A] w-14">生成模型</span>
                <span className="text-[#353535]">{sr.model || '—'}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 场景化课件快捷模板（小微/场景化制作入口） */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">场景化课件（一键套用）</label>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            setCwExtra('英语场景对话：购物/问路/就餐情景对话，带绘图（句型结构树与场景简笔画），满足10分钟讲课时长，配点读跟读')
            toast('已带入「英语场景对话」场景要求，点 AI 生成即可', 'success')
          }} className="px-2.5 py-1.5 text-[12px] bg-[#EAF7FF] text-[#0284C7] rounded-full hover:bg-[#D6EEFF] transition-colors">
            🗣 英语场景对话
          </button>
          <button onClick={() => {
            setCwExtra('带绘图：重难点页用投屏白板现场绘制（思维导图/句型树/实验示意图），满足10分钟讲课时长')
            toast('已带入「带绘图」场景要求', 'success')
          }} className="px-2.5 py-1.5 text-[12px] bg-[#EAF7FF] text-[#0284C7] rounded-full hover:bg-[#D6EEFF] transition-colors">
            ✏️ 带绘图讲解
          </button>
          <button onClick={() => {
            setCwExtra('满足10分钟讲课时长：不少于12页，含热身导入→对话示范→句型操练→小组活动→巩固练习→小结作业，配点读跟读与自动播放')
            toast('已带入「10分钟课时」场景要求', 'success')
          }} className="px-2.5 py-1.5 text-[12px] bg-[#EAF7FF] text-[#0284C7] rounded-full hover:bg-[#D6EEFF] transition-colors">
            ⏱ 10分钟课时
          </button>
          <button onClick={() => {
            setCwExtra('英语场景对话：校园生活/购物/问路情景对话，带绘图（对话气泡图+句型结构树），配点读跟读与自动播放，满足10分钟讲课时长')
            toast('已组好完整场景，点 AI 生成即可', 'success')
          }} className="px-2.5 py-1.5 text-[12px] bg-[#EAF7FF] text-[#0284C7] rounded-full hover:bg-[#D6EEFF] transition-colors">
            ✨ 英语对话·绘图·点读·自动（全套）
          </button>
          {/* 修复（2026-09-13）：此按钮样式原为**硬编码深蓝选中态**（bg-[#02A7F0] text-white），
              在 PPT 页里永远看起来"已选中" → 用户误以为"这份课件是按它生成的"（"脱节"的视觉来源之一）。
              统一为与其它 chip 相同的浅色样式：它只是**快捷填入补充要求**的入口，不代表任何已生效状态。 */}
        </div>
        <span className="text-[10px] text-[#9A9A9A] mt-1.5 block">也可在左下角小微对话提需求，点「应用到当前内容」自动带入并生成。</span>
        {/* 明确"参数 ≠ 对当前课件生效"：以下都是**生成参数**，改完要点「AI 生成课件」重新生成；
            否则用户会以为点了就作用在正在编辑的课件上（"脱节"的另一半来源）。 */}
        <span className="text-[10px] text-[#FA8C16] mt-1 block">
          ⚠ 以上为「生成参数」：改动只在点「AI 生成课件」重新生成时生效，不会改动画布上的现有内容。
        </span>
      </div>

      {/* 风格模板（P1）：AI 一键生成不同视觉风格，标签由后端 facet 词表动态提供（AI 巡增） */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">课件风格（AI 一键定调）</label>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setGenStyleTag('')}
            className={`px-2.5 py-1 text-[12px] rounded-full border transition-colors ${genStyleTag === '' ? 'bg-[#02A7F0] text-white border-[#02A7F0]' : 'bg-white text-[#555] border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
            AI 智能推荐
          </button>
          {/* 风格芯片（2026-09-15 修）：**值必须是风格 key**（china/tech/…），不能是中文标签。
              实测：`/api/facets?type=motif` 的 `value` 是中文（"国风"/"科技"），此前直接当 style_tag 传给
              后端与 `defaultThemeForStyle` → 后端风格语汇认不出、模板又用 key 匹配 → 皮肤一律回落
              `min-classic-blue`：教师点"国风"却得到默认蓝，选风格等于没选（两份不同"风格"看起来一模一样）。
              这里把词表值映射回 key（认不出就原样保留，兼容后续 AI 巡增的新标签），标签仍显示中文。 */}
          {(() => {
            const labelToKey = Object.fromEntries(
              (Object.entries(STYLE_LABELS) as [StyleTag, string][]).map(([k, lb]) => [lb, k]))
            const raw = motifTags.length ? motifTags.map(t => t.value) : (Object.keys(STYLE_LABELS) as StyleTag[])
            const opts: Array<{ value: string; label: string }> = []
            for (const s of raw) {
              const value = labelToKey[s] || s
              if (opts.some(o => o.value === value)) continue          // 词表里同一风格可能有多条（实测"国风"两条）
              opts.push({ value, label: motifTags.find(t => t.value === s)?.label || STYLE_LABELS[s as StyleTag] || s })
            }
            return opts.map(o => (
              <button key={o.value} onClick={() => setGenStyleTag(o.value as StyleTag)}
                className={`px-2.5 py-1 text-[12px] rounded-full border transition-colors ${genStyleTag === o.value ? 'bg-[#02A7F0] text-white border-[#02A7F0]' : 'bg-white text-[#555] border-[#E7E7EB] hover:border-[#02A7F0]'}`}>
                {o.label}
              </button>
            ))
          })()}
        </div>
        <input value={genStyleProfile} onChange={e => setGenStyleProfile(e.target.value)} placeholder="或描述想要的感觉，如：科技感强一点、活泼卡通"
          className="w-full mt-2 px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0]" />
        <span className="text-[10px] text-[#9A9A9A] mt-1 block">风格标签由 AI 每月巡增，生成后自动套用最匹配模板配色。</span>
      </div>

      {/* 参照课件 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-2">参照课件（可选）</label>
        <select value={genBaseId} onChange={e => setGenBaseId(e.target.value)}
          className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0]">
          <option value="">不参照（由 AI 自动匹配相近课件）</option>
          {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* 知识点范围（右侧知识图谱选取） */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-[#353535]">知识点范围（可选）</span>
          <span className="text-[10px] text-[#9A9A9A]">已选 {picker.selectedIds.length} 个</span>
        </div>
        {picker.selectedNodes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {picker.selectedNodes.map((n: any) => (
              <span key={n.id} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[#F0F0F0] text-[#353535] rounded-full">
                {n.name}
                <button onClick={() => picker.setSelectedIds(picker.selectedIds.filter((id: string) => id !== n.id))} className="text-[#9A9A9A] hover:text-[#FF4D4F]">✕</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[#9A9A9A]">可在右侧知识图谱中选取锚点知识点（AI 模式）</p>
        )}
      </div>

      {/* 附加要求 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-1.5">附加要求 / 关键词</label>
        <textarea value={cwExtra} onChange={e => setCwExtra(e.target.value)} rows={2}
          placeholder="如：多放实验图示、加入生活案例、风格活泼…（也可先在左下角小微对话提需求，自动带入）"
          className="w-full px-2.5 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0] resize-none" />
      </div>

      {/* 发散度 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0]">
        <label className="block text-[12px] font-medium text-[#353535] mb-1.5">发散度（受控启发）</label>
        <select value={divergenceLevel} onChange={e => setDivergenceLevel(e.target.value as any)}
          className="w-full px-2.5 py-2 text-[13px] border border-[#E7E7EB] rounded-[4px] bg-white outline-none focus:border-[#02A7F0]">
          <option value="conservative">保守（少量跨界）</option>
          <option value="standard">标准（适度启发）</option>
          <option value="expansive">发散（大开脑洞）</option>
        </select>
        <span className="text-[10px] text-[#9A9A9A] mt-1 block">轨道区可跨界 / 适度超纲，但受 ±1 年级档与课标对齐约束。</span>
      </div>

      {/* 边缘知识 */}
      <div className="px-5 py-3 border-t border-[#F0F0F0] space-y-2">
        <label className="flex items-center gap-2 text-[12px] text-[#353535]">
          <input type="checkbox" checked={edgeEnabled} onChange={e => setEdgeEnabled(e.target.checked)} />
          融入价值观 / 行为 / 情感（边缘知识，靠互动承载）
        </label>
        {edgeEnabled && (
          <div className="pl-5 space-y-1">
            {Object.keys(edgeCats).map(k => (
              <label key={k} className="flex items-center gap-2 text-[11px] text-[#353535]">
                <input type="checkbox" checked={edgeCats[k]} onChange={e => setEdgeCats(s => ({ ...s, [k]: e.target.checked }))} />
                {k}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 课前问诊 */}
      {consultQuestions.length > 0 && (
        <div className="px-5 py-3 border-t border-[#F0F0F0] space-y-2">
          <p className="text-[12px] font-medium text-[#353535]">课前问诊（逐项确认方向）</p>
          {consultQuestions.map((q: any) => (
            <div key={q.id}>
              <p className="text-[11px] text-[#353535] mb-1">{q.question}</p>
              <select value={consultAnswers[q.id] || ''} onChange={e => setConsultAnswers(s => ({ ...s, [q.id]: e.target.value }))}
                className="w-full px-2 py-1.5 text-[11px] border border-[#E7E7EB] rounded-[3px] bg-white outline-none focus:border-[#02A7F0]">
                <option value="">请选择…</option>
                {(q.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* 生成按钮（仅 AI 模式显示；文档模式提纲已生成，无需此按钮） */}
      {workMode === 'ai' && (
        <div className="px-5 py-4 border-t border-[#F0F0F0]">
          <button onClick={() => handleGenCourseware()} disabled={genLoading} title={genStage?.message || undefined}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] text-white bg-[#02A7F0] rounded-[4px] hover:bg-[#0398D8] disabled:opacity-50 transition-colors">
            {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {/* 进度短文案（完整合规详情见 title 悬浮）：150~200s 的等待必须有可感知的推进 */}
            {genLoading
              ? (genStage?.stage === 'retry' ? 'AI 修订中…' : genStage?.stage === 'gate1' ? 'AI 校验中…' : 'AI 生成中…')
              : (pageCount > 0 ? '重新生成课件' : 'AI 生成课件')}
          </button>
          {cwSimilar && <p className="text-[10px] text-[#9A9A9A] mt-2">参照相近课件《{cwSimilar.name}》生成的新版本</p>}
        </div>
      )}
    </EditorInfoPanel>
  )
}
