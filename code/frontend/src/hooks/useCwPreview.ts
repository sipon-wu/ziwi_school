/**
 * 预览 / 放映领域 hook（P0-1 拆分 God Component 第六步 · 2026-09-16）
 *
 * 管"这份课件看起来是第几页"：
 *   状态 = docSlide（正文页下标，不含封面）+ deckIdx（整本页序，0 = 封面）+ goToPage（两者同步）；
 *   派生 = cwThumbSlides（左栏缩略图，与画布同源）+ previewSlides（只读放映页）。
 *
 * ★ 为什么页序要两个、且必须成对更新
 *   outlineToSlides() 会在正文前自动插入**封面页**，于是"整本的页码"与"提纲的下标"相差 1。
 *   历史上正是这里出错：`index={docSlide + 1}` 让封面永远不可达（教师反馈"为什么 PPT 没有封面"）。
 *   故由本 hook 提供唯一的 `goToPage(deck)`，把"切整本第 N 页"映射回正文下标，
 *   **调用方不再自己写两个 setState** —— 此前这段同步逻辑在组件里重复了 5 次。
 *   docSlide 之所以保留（不并入 deckIdx）：批注/版本按 `page = docSlide + 1` 锚定且**已存库**，
 *   改语义会让旧批注集体错页。
 *
 * ★ 为什么本 hook 的调用点必须在 `cwAr` 之后
 *   hook 内的 useMemo 要在渲染期调用 `cwOpts()`，而 cwOpts() 会读 cwAr（版心比例）。
 *   若放在 cwAr 声明之前 → 渲染期访问 cwAr 踩 TDZ 直接崩。同理不能放在 cwOpts 之前。
 *   代价：`useCwDecor` 的调用点随之下移到本 hook 之后（它要读 docSlide）。
 *
 * 拆分原则（同前五刀）：行为逐行搬迁、不改逻辑；对外返回值沿用原命名。
 */
import { useMemo, useState } from 'react'
import { outlineToSlides, type CwOptions, type OutlineSlide } from '../lib/exportPptx'

export interface UseCwPreviewOpts {
  cwOutline: OutlineSlide[]
  cwOpts: () => CwOptions
  // 以下是 cwOpts() 的输入，**仅用于 useMemo 的依赖数组**：
  // 保证"生成参数变了就重算封面"（见下方 previewSlides 的注释）。
  subject: string
  gradeName: string
  title: string
  classLabel: string
  themeId: string
  colorRoot: string
  aspect: string
  /** 封面装饰（2026-09-17）：封面不在 outline 内，其素材需单独传入；来源见 CoursewareBuilder 的 parseCoverDecor */
  coverDecor?: OutlineSlide['decor']
}

export function useCwPreview({
  cwOutline, cwOpts, subject, gradeName, title, classLabel, themeId, colorRoot, aspect, coverDecor,
}: UseCwPreviewOpts) {
  // 正文页下标（不含封面）—— 批注/版本/互动按页逻辑都用它
  const [docSlide, setDocSlide] = useState(0)
  // 整本页序（0 = 封面）—— 页列表、画布、放映都用它
  const [deckIdx, setDeckIdx] = useState(0)

  /** 切到整本第 deck 页；deck 0 = 封面（封面不属于 outline，故正文下标保持 0） */
  const goToPage = (deck: number) => {
    setDeckIdx(Math.max(0, deck))
    setDocSlide(Math.max(0, deck - 1))
  }

  // 缩略图数据（2026-09-14）：真实缩略图必须与画布**同源**，否则又变成"缩略图≠画布"。
  // outlineToSlides 会在最前插入封面页 → 索引 = 提纲页 +1。
  const cwThumbSlides = cwOutline.length ? outlineToSlides(cwOutline, cwOpts(), coverDecor) : []

  // ── 查看态只读放映内容（左缩略图导航 + 右可滚动放映），view 态 secondaryRight 与全屏 previewSlot 共用 ──
  const previewSlides = useMemo(() => {
    if (cwOutline.length === 0) return null
    try {
      return outlineToSlides(cwOutline, cwOpts(), coverDecor)
    } catch (e) {
      console.error('previewSlides: outlineToSlides failed', e)
      return null
    }
    // 依赖必须含 cwOpts() 的全部输入（2026-09-15 修）：此前只有 [cwOutline]，
    // 而学科/年级/班级/署名/主题都是**异步随后**才到的（班级要等 /my-classes、姓名要等登录用户）
    // → 封面页被**缓存成"当时还没值"的版本**，于是封面信息条永远空着、
    // 副标题还留着"· 教师"占位（教师实测）。这类"输入变了、结果不重算"是同一族缺陷。
  }, [cwOutline, subject, gradeName, title, classLabel, themeId, colorRoot, aspect, coverDecor])

  return { docSlide, deckIdx, goToPage, cwThumbSlides, previewSlides }
}
