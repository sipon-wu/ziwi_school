/**
 * 保存 / 发布领域 hook（P0-1 拆分 God Component 第四步 · 2026-09-16）
 *
 * 管「把当前课件落库」这一件事：
 *   状态 = savingCw（发布中）、pendingGenSave（生成完待自动存一稿的标记）；
 *   动作 = handleSaveDraft（保存草稿 + 版本裁决）、handlePublish（红线校验 → 发布 → H5 二维码）。
 *
 * ★ 为什么入参是一个 `getDoc()` 而不是 19 个参数
 *   保存/发布读的是**整份文档快照**（提纲 + 生成配方 + 风格 + 产物 + 上下文），
 *   逐个列进签名既臃肿又易漏。而"惰性取值"还顺带解决了本簇的**循环依赖**：
 *     handleSaveDraft 要读 cwVer（useVersions）
 *       → cwVer 依赖 cwLocked = ctrl.status
 *         → ctrl = useEditorController({ onSaveDraft: handleSaveDraft })   ← 回到起点
 *   改成"调用时才取快照"（getDoc），cwVer / ctrl 在保存发生的那一刻必然已初始化，
 *   无需为破环引入 ref 中转。语义上也更贴切：**保存 = 对当前文档快照的一次操作**。
 *
 * 拆分原则（同前三刀）：行为逐行搬迁、不改逻辑；对外返回值沿用原命名。
 * 注：生成后的自动存一稿 effect 留在组件内 —— 它的依赖数组要写 `[cwOutline]`，
 *     放进 hook 就得在依赖里调用 getDoc()，反而更绕。
 */
import { useRef, useState } from 'react'
import { aiAPI, materialAPI } from '../lib/api'
import { outlineToMarkdown, normalizeInteractive, type CwOptions, type OutlineSlide } from '../lib/exportPptx'
import { markdownToStorybookH5 } from '../lib/courseware-h5'
import QRCode from 'qrcode'
import { decideVersion, type VersionTrigger } from '../lib/versionPolicy'
import { safeGetUser, type ScopeResolvedPayload } from '../lib/domain'
import type { StyleTag } from '../lib/cwTemplate'
import { useVersions } from '../hooks/useAnnotations'
import type { UseKnowledgePickerReturn } from '../hooks/useKnowledgePicker'
import { useToast } from '../components/Toast'

/** 保存/发布那一刻的文档快照（由调用方通过 getDoc 惰性提供） */
export interface CwSaveDoc {
  // ── 生成参数：决定落库的标题 / 标签 / gen_params ──
  genTitle: string
  cwExtra: string
  genStyleTag: StyleTag | ''
  genStyleProfile: string
  divergenceLevel: 'conservative' | 'standard' | 'expansive'
  edgeEnabled: boolean
  edgeCats: Record<string, boolean>
  // ── 产物 ──
  cwOutline: OutlineSlide[]
  cwMarkdown: string
  cwH5Html: string
  cwDivergence: unknown[]
  scopeResolved: ScopeResolvedPayload | null
  themeId: string
  colorRoot: string
  videoConfig: unknown
  // ── 上下文 ──
  cwFormat: 'ppt' | 'h5' | 'video'
  subject: string
  gradeName: string
  /** 教材版本名快照（teaching.currentTextbook()，解析口径：学校/班级/教师） */
  textbookName: string
  picker: UseKnowledgePickerReturn
  materialId: string
  /** 本地兜底暂存的 key（getDraftKey(materialId)） */
  draftKey: string
  cwOpts: () => CwOptions
  /** 版本快照源（useVersions）——循环依赖的一环，故随快照惰性取 */
  cwVer: ReturnType<typeof useVersions>
  /** 编辑器控制器——循环依赖的一环（发布校验未通过时要切回文档模式） */
  ctrl: { setWorkMode: (mode: 'ai' | 'doc') => void }
}

export interface UseCwSaveOpts {
  /** 惰性取当前文档快照（保存/发布发生的那一刻才调用） */
  getDoc: () => CwSaveDoc
  setMaterialId: (id: string) => void
  setValidating: (v: boolean) => void
  setValidateIssues: (v: unknown[] | null) => void
  setH5Qr: (v: { url: string; dataUrl: string } | null) => void
}

/** 键排序的稳定序列化：比较"内容有没有变"用（见 takeSaveVersion 的注释） */
const stableJson = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']'
  const o = v as Record<string, unknown>
  return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stableJson(o[k])).join(',') + '}'
}

export function useCwSave({
  getDoc, setMaterialId, setValidating, setValidateIssues, setH5Qr,
}: UseCwSaveOpts) {
  const { toast } = useToast()
  const [savingCw, setSavingCw] = useState(false)
  // 生成完成后置 true，由组件里的 effect 在状态提交后触发「自动存一稿」
  // （不能在生成函数里直接存：刚 setState 的 themeId/colorRoot 尚未生效，会把旧主题写进草稿）
  const pendingGenSave = useRef(false)

  /**
   * 保存草稿 → 形成版本（产品规则 2026-09-15：生成 / 保存草稿 / 发布 三个时机各形成版本）。
   * · 生成后的第一次保存记作「AI 生成」（见 pendingGenVersion）
   * · 其余记作「保存草稿」；发布由后端写 `kind=release`
   * · **内容没变不重复建**（同 label 且 payload 相同 → 跳过）：连点保存不该堆出重复版本
   * · **自动保存额外 3 分钟节流**：自动保存频繁，逐次建版本会把列表灌满；
   *   教师**点击**保存则每次都形成版本（不受节流限制）
   */
  const takeSaveVersion = async (d: CwSaveDoc, opts: { trigger: VersionTrigger; outline?: OutlineSlide[] }) => {
    const outline = opts.outline || d.cwOutline
    const label = opts.trigger === 'gen' ? 'AI 生成（一稿）' : '保存草稿'
    // ⚠️ 不能直接比字符串：payload 落的是 **jsonb** 列，PG 会重排键、去空白，
    // 读回来的字符串与写进去的必然不同（实测：字符串比较 → 每次判"变了" → 连点保存堆版本）。
    // 故用**键排序的稳定序列化**语义比较。
    const snap = stableJson(outline)
    const last: any = d.cwVer.items[0]
    let lastSnap = ''
    try { lastSnap = last?.payload ? stableJson(JSON.parse(String(last.payload))) : '' } catch { lastSnap = '' }
    const decision = decideVersion({
      trigger: opts.trigger, last, contentSame: !!lastSnap && lastSnap === snap,
    })
    if (decision !== 'create') return     // 内容没变（skip-identical）或落在合并窗口内（skip-window）
    await d.cwVer.take(label, outline)
  }

  const handleSaveDraft = async (opts?: { trigger?: VersionTrigger; outline?: OutlineSlide[] }) => {
    const d = getDoc()
    // outline 可显式传入：刚生成完就调用时，state 里的 cwOutline 还是旧值（闭包），必须显式带过去
    const outline = opts?.outline || d.cwOutline
    const payload = {
      name: `${d.genTitle.trim() || '未命名'}_课件`,
      type: 'courseware',
      format: d.cwFormat,
      tag: `${d.subject}${d.gradeName}`,
      content: outlineToMarkdown(outline, d.cwOpts()),
      status: 'draft',
      grade: d.gradeName,
      subject: d.subject,
      theme_id: d.themeId, // 模板引用持久化：源数据=提纲(content)+模板引用(theme_id)，渲染随时由模板重算
      color_root: d.colorRoot, // 课件专属配色 DNA（Skill 当次生成）；随提纲落库，渲染优先于 theme_id
      // 溯源（2026-09-13）：教材版本**实体引用** + 单元 —— 来自知识图谱实体（与后端同源），
      // 不是自由文本。此前只落产物，编辑页因此回填不出"来源"（"左栏与画布脱节"的根因）。
      textbook_version_id: ((d.picker.selectedNodes[0] as any)?.version_id
        || (d.picker.knowledgeData.find((n: any) => n.version_id) as any)?.version_id || '') as string,
      unit: (d.picker.selectedUnit || (d.picker.selectedNodes[0] as any)?.unit || '') as string,
      // ── 生成配方 / 溯源（2026-09-13）──
      // 目的：落"这份课件是按什么生成的"，修"从预览进编辑、左栏与画布脱节"。
      // 素材表已由 migrations/0009 加列；Go 侧 DTO/handler 已接线（material_handler.go）。
      // （2026-09-13 更新）textbook_version_id 不再留空：已由知识图谱节点自带的 version_id
      // 填入（见上方），教材版本**实体引用**的链路已通。
      gen_params: d.scopeResolved
        ? JSON.stringify({
            ...d.scopeResolved,                         // 含 scope_resolved（知识面来源/前置来源/发散边界）
            textbook_version_name: d.textbookName,      // 快照（解析口径：学校/班级/教师）
            subject: d.subject,
            grade: d.gradeName,
            extra_requirements: d.cwExtra || '',
            divergence_level: d.divergenceLevel,
            edge_enabled: d.edgeEnabled,
            edge_categories: Object.entries(d.edgeCats).filter(([, v]) => v).map(([k]) => k),
            style_tag: d.genStyleTag || '',
            style_profile: d.genStyleProfile || '',
            style_mode: d.genStyleTag ? 'preset' : (d.genStyleProfile.trim() ? 'free' : 'auto'),
            captured_at: new Date().toISOString(),
          })
        : undefined,
    }
    // H5 草稿也落派生 HTML（2026-09-15）：课堂扫码 / 投屏打开的是 `/api/materials/:id/h5`，
    // 该端点**优先返回 h5_html**，而草稿态此前从不写它 → 教师扫码看到的是后端兜底的"纯展示页"
    // （不是绘本：没有翻页/点读/互动，也不是课堂用的 16:9 固定比例）。发布路径早已写入，这里补齐草稿路径。
    if (d.cwFormat === 'h5') {
      try {
        const html = markdownToStorybookH5(outlineToMarkdown(outline, d.cwOpts()), {
          subject: d.subject, grade: d.gradeName, title: d.genTitle.trim(),
          teacherName: safeGetUser().name || '教师', themeId: d.themeId, colorRoot: d.colorRoot,
        })
        if (html) (payload as { h5_html?: string }).h5_html = html
      } catch { /* 派生失败不阻塞保存（保存的是源数据，渲染随后可重算） */ }
    }
    try {
      // 本地兜底暂存（未发布前可恢复）
      localStorage.setItem(d.draftKey, JSON.stringify({
        title: d.genTitle, extra: d.cwExtra, markdown: d.cwMarkdown,
        outline, h5Html: d.cwH5Html, divergence: d.cwDivergence, divergenceLevel: d.divergenceLevel, themeId: d.themeId,
        videoConfig: d.videoConfig,
      }))
      if (d.materialId) {
        await materialAPI.update(d.materialId, payload)
      } else {
        const m: any = await materialAPI.createJSON(payload)
        if (m?.id) setMaterialId(m.id)
      }
      // 版本：按触发来源决定是否形成版本（生成=总是；点击=合并窗口；自动=节流）——见 lib/versionPolicy.ts
      await takeSaveVersion(d, { trigger: opts?.trigger || 'click', outline })
      toast(opts?.trigger === 'gen' ? '已自动保存为一稿草稿' : '草稿已保存', 'success')
    } catch (e: any) { toast('草稿保存失败: ' + (e.message || ''), 'error') }
  }

  // 必须在 ctrl = useEditorController(...) 之前声明，避免 const 的 TDZ 类型报错
  // （本 hook 的调用点位于组件中 ctrl 赋值之前，顺序保持不变）
  const handlePublish = async () => {
    const d = getDoc()
    if (!d.genTitle.trim()) { toast('请填写课题名称', 'warning'); return }
    if (!d.cwOutline.length) { toast('课件内容为空，请先生成课件', 'warning'); return }
    setValidating(true)
    try {
      const r: any = await aiAPI.validateCourseware({
        markdown: d.cwMarkdown || outlineToMarkdown(d.cwOutline, d.cwOpts()), subject: d.subject, grade: d.gradeName,
      })
      if (!r.pass) {
        setValidateIssues(r.issues || [])
        d.ctrl.setWorkMode('doc')
        toast('发布校验未通过，请按提示修改后再发布', 'warning')
        return
      }
      setValidateIssues(null)
    } catch (e: any) {
      toast('校验失败: ' + (e.message || '未知错误'), 'error')
      return
    } finally { setValidating(false) }
    setSavingCw(true)
    try {
      const payload: any = {
        name: `${d.genTitle.trim()}_课件`,
        type: 'courseware',
        format: d.cwFormat,
        tag: `${d.subject}${d.gradeName}`,
        content: outlineToMarkdown(d.cwOutline, d.cwOpts()),
        status: 'active',
        grade: d.gradeName,
        subject: d.subject,
        theme_id: d.themeId, // 模板引用持久化：源数据=提纲(content)+模板引用(theme_id)，渲染随时由模板重算
        color_root: d.colorRoot, // 课件专属配色 DNA（Skill 当次生成）；随提纲落库，渲染优先于 theme_id
        // 互动插槽摘要快照（每页 interactive 序列化，支持数组）；留空数组=真清空（指针区分）
        interactive_slots: JSON.stringify(d.cwOutline.map(s => normalizeInteractive(s.interactive))),
      }
      // H5 互动课件：发布时**一律按当前提纲 + 当前 themeId/colorRoot 重渲染**，
      // 不复用可能过期的 cwH5Html——否则换风格/改内容后发布，扫码打开的仍是旧皮肤。
      // 与上方「源数据=提纲(content) + 模板引用(theme_id)，渲染随时由模板重算」原则一致。
      if (d.cwFormat === 'h5') {
        payload.h5_html = markdownToStorybookH5(outlineToMarkdown(d.cwOutline, d.cwOpts()), {
          // 标题**不带 `_课件` 后缀**（2026-09-16 修）：`_课件` 只是素材库的存储命名约定，
          // 此前发布路径把它印进了 H5 顶部标题与封面 —— 于是同一份课件草稿态扫码是
          // 「天窗 09-15」、发布后变成「天窗 09-15_课件」（草稿保存路径早已不带后缀，两处不一致）。
          subject: d.subject, grade: d.gradeName, title: d.genTitle.trim(),
          teacherName: safeGetUser().name || '教师', themeId: d.themeId,
          colorRoot: d.colorRoot,
        })
      }
      let newId = d.materialId
      if (d.materialId) await materialAPI.update(d.materialId, payload)
      else {
        const m: any = await materialAPI.createJSON(payload)
        if (m?.id) { setMaterialId(m.id); newId = m.id }
      }
      try { localStorage.removeItem(d.draftKey) } catch { /* noop */ }
      toast('课件已发布', 'success')
      // H5：发布后弹出扫码查看二维码（手机扫码即可在浏览器打开投屏互动课件）
      if (d.cwFormat === 'h5' && newId) {
        const url = `${window.location.origin}/api/materials/${newId}/h5`
        const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 1 })
        setH5Qr({ url, dataUrl })
      }
    } catch (e: any) { toast('发布失败: ' + (e.message || ''), 'error') }
    finally { setSavingCw(false) }
  }

  return { savingCw, pendingGenSave, handleSaveDraft, handlePublish }
}
