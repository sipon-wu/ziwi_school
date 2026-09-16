/**
 * 模板套用领域 hook（P0-1 拆分 God Component 第五步 · 2026-09-16）
 *
 * 管「给提纲换皮」这一件事——条 TWO 条入口，同一套状态：
 *   · 左栏**模板库面板**：选风格/色系过滤 → 点模板套用 → 可「撤销套用」
 *   · 小微**换风格指令**（window 事件 `zhiwei:switch-style`）：含 dry-run 预演与轻/重档
 *   两条入口都走 `applyTemplate` / `revertTemplate` 的**确定性路径**：只换风格语汇
 *   （配色 / 标题形态 / 底纹 / 装饰），**绝不重新生成内容**。
 *
 *   状态 = 面板开关 + 风格/色系筛选标签；
 *   存档 = tplAppliedId / tplPrev{Theme,Layouts,Elements} —— "上次套用前的样子"，用于撤销；
 *   动作 = applyTemplateEntry / applyFamilyEntry / undoTemplateApply / 换风格事件监听。
 *
 * ★ 为什么部分入参是惰性 getter（getLocked / getVer / getRefOutline）
 *   这三者声明在本 hook 调用点之后（cwLocked 依赖 ctrl、cwVer 依赖 materialId、
 *   loadRefOutline 依赖 accumulated 的提纲管道），而本 hook 又要早于 useCwDecor 调用
 *   （装饰簇要读 tplAppliedId 做"AI 装饰推荐"）。惰性取值既避开 TDZ，也不需要 ref 中转。
 *   注意：这些 getter 只允许在**事件/异步回调里**调用，渲染期调用会踩 TDZ。
 *
 * 拆分原则（同前四刀）：行为逐行搬迁、不改逻辑；对外返回值沿用原命名。
 */
import { useEffect, useRef, useState } from 'react'
import {
  PPT_TEMPLATES, H5_TEMPLATES, COLOR_FAMILIES, STYLE_LABELS,
  applyTemplate, revertTemplate, reflowToSkeleton, basicTemplateForFamily, templateStyleTags,
  defaultThemeForStyle, gradeToStage, type StyleTag,
} from '../lib/cwTemplate'
import { styleKeyFromThemeId } from '../lib/styleRegistry'
import type { OutlineSlide } from '../lib/exportPptx'
import { useVersions } from '../hooks/useAnnotations'
import { useToast } from '../components/Toast'

export type CwTemplateEntry = typeof PPT_TEMPLATES[number]
export type ColorFamily = typeof COLOR_FAMILIES[number]

export interface UseCwTemplateOpts {
  cwOutline: OutlineSlide[]
  setCwOutline: React.Dispatch<React.SetStateAction<OutlineSlide[]>>
  themeId: string
  setThemeId: React.Dispatch<React.SetStateAction<string>>
  cwFormat: 'ppt' | 'h5' | 'video'
  grade: number
  subject: string
  /** 已发布定版？（本 hook 调用点之后才有值 → 惰性） */
  getLocked: () => boolean
  /** 版本快照源（本 hook 调用点之后才有值 → 惰性） */
  getVer: () => ReturnType<typeof useVersions>
  /** 空提纲时从「参照课件」载入提纲（本 hook 调用点之后才有值 → 惰性） */
  getRefOutline: () => Promise<OutlineSlide[]>
}

export function useCwTemplate({
  cwOutline, setCwOutline, themeId, setThemeId, cwFormat, grade, subject,
  getLocked, getVer, getRefOutline,
}: UseCwTemplateOpts) {
  const { toast } = useToast()

  // ── 模板套用面板状态 ──
  const [tplPanelOpen, setTplPanelOpen] = useState(false)
  // ★ 聚类标签：风格/色系多选（OR 语义），替代互斥分类导航
  const [tplStyleTags, setTplStyleTags] = useState<StyleTag[]>([])
  const [tplColorTags, setTplColorTags] = useState<string[]>([])

  // ── "上次套用前"的存档（供撤销 / 换回上一个风格）──
  const tplAppliedId = useRef<string | null>(null)
  const tplPrevTheme = useRef<string | null>(null)
  const tplPrevLayouts = useRef<(string | undefined)[] | null>(null)
  // 元素几何快照（2026-09-15）：「重新套版」（重档）会重排元素位置 —— 只记 layout 不足以回退，
  // 必须连 elements 一起记，否则"换回上一个风格"撤不掉位置变化。
  const tplPrevElements = useRef<((OutlineSlide['elements']))[] | null>(null)

  /**
   * 选定某个模板套用（模板库列表 / 通用结构的共同动作）。
   * 注：这里**不记** tplPrevElements —— 面板套用不跑重档，元素几何没变，
   * 与原实现保持一致（只有小微的 heavy 档才会重排几何，那里才需要记）。
   */
  const applyTemplateEntry = async (tpl: CwTemplateEntry, okToast: string) => {
    const baseOutline = cwOutline.length ? cwOutline : await getRefOutline()
    const r = applyTemplate(baseOutline, tpl, themeId, { stage: gradeToStage(grade), subject })
    setCwOutline(r.outline); setThemeId(r.themeId)
    tplAppliedId.current = tpl.id; tplPrevTheme.current = r.prevThemeId; tplPrevLayouts.current = r.prevLayouts
    setTplPanelOpen(false)
    toast(okToast, 'success')
    // 装饰匹配改为手动：教师在替换装饰面板点「智能配饰」才按风格匹配（B 方案，不干扰套模板主流程）
  }

  /** 通用结构（结构 × 色系自由组合） */
  const applyFamilyEntry = async (f: ColorFamily) => {
    const baseOutline = cwOutline.length ? cwOutline : await getRefOutline()
    const tpl = basicTemplateForFamily(f)
    const r = applyTemplate(baseOutline, tpl, themeId, { stage: gradeToStage(grade), subject })
    setCwOutline(r.outline); setThemeId(r.themeId)
    tplAppliedId.current = tpl.id; tplPrevTheme.current = r.prevThemeId; tplPrevLayouts.current = r.prevLayouts
    setTplPanelOpen(false)
    toast(`已套用：通用结构 · ${f.label}`, 'success')
  }

  /** 面板上的「撤销套用」 */
  const undoTemplateApply = () => {
    if (tplPrevTheme.current != null && tplPrevLayouts.current) {
      // 带 prevElements：重档改过元素几何，只回退 layout 撤不掉位置
      const r = revertTemplate(cwOutline, tplPrevTheme.current, tplPrevLayouts.current, tplPrevElements.current)
      setCwOutline(r.outline); setThemeId(r.themeId)
      tplAppliedId.current = null; tplPrevTheme.current = null; tplPrevLayouts.current = null
      tplPrevElements.current = null
      toast('已撤销模板套用', 'info')
    }
  }

  /**
   * 生成流程**自动套用**模板后写入存档（抽出本簇时补的动作）。
   * 原先组件里直接写这三个 ref —— 存档已归本 hook 私有，改由这里写入，
   * 使"谁写了存档"收敛在一处，避免将来漏字段（如 prevElements）。
   * 注：这里同样**不写** prevElements：本次未跑重档，元素几何没变。
   */
  const noteTemplateApplied = (id: string, prevThemeId: string | null, prevLayouts: (string | undefined)[] | null) => {
    tplAppliedId.current = id
    tplPrevTheme.current = prevThemeId
    tplPrevLayouts.current = prevLayouts
  }

  // 小微「换风格 / 恢复上一个风格」指令的接收端（2026-09-14）：
  // 与模板库按钮走**同一条确定性路径**（`applyTemplate` / `revertTemplate`）—— 只换风格语汇
  // （配色 / 标题形态 / 底纹 / 装饰），**绝不重新生成内容**（重生成会内容漂移、花 1~3 分钟，
  // 且实测返修还会更差）。派发是**同步**的：小微在 dispatch 返回后立刻读 detail.handled，
  // 因此能如实回报"已切换"还是"当前不在课件编辑器里"，而不是猜。
  useEffect(() => {
    const onSwitchStyle = async (ev: Event) => {
      const d = (ev as CustomEvent).detail as
        { styleTag?: StyleTag; revert?: boolean; level?: 'light' | 'heavy'; dryRun?: boolean
          handled?: boolean; error?: string; impact?: { pages: number; elements: number }
          snapshot?: boolean; resolve?: () => void } | undefined
      if (!d) return
      try {
        // 发布定版（cwLocked）与既有"版本仅供查看、不可存/回退"语义保持一致：**拒绝执行并如实回报**。
        // 不能装作换成功 —— 定版下既存不了快照，也回退不了（后端 403）。
        if (getLocked()) {
          d.error = '已发布定版：版本仅供查看、不可存/回退 —— 请先点「编辑」重新进入草稿，再换风格'
          return
        }
        if (d.revert) {
          if (!tplPrevTheme.current || !tplPrevLayouts.current) { d.error = '本次编辑内还没换过模板，没有可恢复的风格'; return }
          // 带上 prevElements：重档改过元素几何，只回退 layout 等于撤不掉位置
          const r = revertTemplate(cwOutline, tplPrevTheme.current, tplPrevLayouts.current, tplPrevElements.current)
          setCwOutline(r.outline); setThemeId(r.themeId)
          tplAppliedId.current = null; tplPrevTheme.current = null; tplPrevLayouts.current = null
          tplPrevElements.current = null
          d.handled = true
          toast('已恢复上一个风格', 'info')
          return
        }
        if (!d.styleTag) return
        const level = d.level === 'heavy' ? 'heavy' : 'light'
        const baseOutline = cwOutline.length ? cwOutline : await getRefOutline()
        const pool = cwFormat === 'h5' ? H5_TEMPLATES : PPT_TEMPLATES
        const tpl = pool.filter((t) => templateStyleTags(t).includes(d.styleTag as StyleTag))[0]
          || basicTemplateForFamily(
            COLOR_FAMILIES.find((f) => f.themeId === defaultThemeForStyle(d.styleTag as StyleTag)) || COLOR_FAMILIES[0],
            cwFormat === 'h5' ? 'h5' : 'ppt')
        const r = applyTemplate(baseOutline, tpl, themeId, {
          stage: gradeToStage(grade), subject,
        })
        // 预演（二次确认用）：**只算不落地** —— 把重档"会重排多少页/多少元素"如实报给教师
        if (d.dryRun) {
          const rk = styleKeyFromThemeId(r.themeId)
          const imp = level === 'heavy'
            ? reflowToSkeleton(r.outline, rk)
            : { pages: 0, elements: 0 }
          d.impact = { pages: imp.pages, elements: imp.elements }
          d.handled = true
          return
        }
        let nextOutline = r.outline
        // 版本配合（2026-09-15）：执行前**自动存一份版本快照** —— 让"可回退"成为跨刷新/跨会话的真承诺，
        // 而不是只活在本次会话的 ref 里（详情见 lib/styleIntent.ts 的二次确认话术）。
        // 预演（dryRun）不存快照 —— 教师还没确认，不该产生副作用。
        const snapLabel = `换风格前（${level === 'heavy' ? '重档' : '轻档'} → ${STYLE_LABELS[d.styleTag as StyleTag] || d.styleTag}）`
        d.snapshot = await getVer().take(snapLabel, baseOutline)
        if (level === 'heavy') {
          nextOutline = reflowToSkeleton(nextOutline, styleKeyFromThemeId(r.themeId)).outline
        }
        setCwOutline(nextOutline); setThemeId(r.themeId)
        tplAppliedId.current = tpl.id; tplPrevTheme.current = r.prevThemeId; tplPrevLayouts.current = r.prevLayouts
        // 快照元素几何，供"换回上一个风格"整页回退（重档必需）
        tplPrevElements.current = baseOutline.map((s) => s.elements)
        d.handled = true
        toast(level === 'heavy' ? `已重新套版：${tpl.name}` : `已套用模板：${tpl.name}`, 'success')
      } catch (e: any) {
        d.error = e?.message || '换风格失败'
      } finally {
        // 处理结束（含异步的「版本快照」）→ 结束小微的等待，它才读得到真实的 handled/snapshot
        d.resolve?.()
      }
    }
    window.addEventListener('zhiwei:switch-style', onSwitchStyle)
    return () => window.removeEventListener('zhiwei:switch-style', onSwitchStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwOutline, themeId, cwFormat, grade, subject])

  return {
    tplPanelOpen, setTplPanelOpen, tplStyleTags, setTplStyleTags, tplColorTags, setTplColorTags,
    tplAppliedId,
    applyTemplateEntry, applyFamilyEntry, undoTemplateApply, noteTemplateApplied,
  }
}
