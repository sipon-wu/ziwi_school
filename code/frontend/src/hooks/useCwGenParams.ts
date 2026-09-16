/**
 * 生成参数领域 hook（P0-1 拆分 God Component 第三步 · 2026-09-16）
 *
 * 管的是「教师按下『生成』之前填的那些东西」——即**生成入参**：
 *   状态 = 课题名称 / 课件风格（预设标签 + 自由画像 + 标签云）/ 补充要求 / 参照课件
 *          / 发散边界（强度 + 边缘类别）/ 课前问诊（题目 + 作答 + 加载中）；
 *   动作 = 风格标签云加载、课前问诊拉取。
 *
 * 拆分原则（与前两刀 useCwDecor / useCwExport 完全一致）：
 *   1. **对外零侵入**：返回值沿用组件内原命名，JSX 与其它调用点无需改动。
 *   2. **不做行为变更**：逻辑逐行搬迁，仅把对外部的读取改成入参（subject / gradeName / picker）。
 *   3. 生成动作本体（handleGenCourseware）**不搬**——它横跨产物、进度、自动保存多个域；
 *      本 hook 只提供它要读的入参和要写的 setter。
 *
 * 为什么这簇值得单独成 hook：左栏「场景化课件」整张表单、生成请求体、草稿保存字段、
 * 以及打开旧课件时的回填，读写的都是这一组参数 —— 它们的变化节奏一致（教师手填），
 * 而与其它状态（产物、装饰、模板、导出）变化节奏完全不同。
 */
import { useEffect, useState } from 'react'
import { aiAPI, facetAPI, type FacetVocab } from '../lib/api'
import type { StyleTag } from '../lib/cwTemplate'
import { buildKnowledgeScope } from '../lib/knowledgeScope'
import type { UseKnowledgePickerReturn } from '../hooks/useKnowledgePicker'

/** 课前问诊题（服务端返回；渲染只用到 id / question / options） */
export interface ConsultQuestion {
  id: string
  question: string
  options?: string[]
}

export interface UseCwGenParamsOpts {
  /** 学科（课前问诊请求用） */
  subject: string
  /** 年级展示名，如"四年级"（课前问诊请求用） */
  gradeName: string
  /** 知识点选择器（问诊请求要据此算知识面） */
  picker: UseKnowledgePickerReturn
}

export function useCwGenParams({ subject, gradeName, picker }: UseCwGenParamsOpts) {
  // ── 课题与风格 ──
  const [genTitle, setGenTitle] = useState('')
  const [genStyleTag, setGenStyleTag] = useState<StyleTag | ''>('')
  const [genStyleProfile, setGenStyleProfile] = useState('')
  // 风格标签云：从后端 facet 词表（motif）动态拉取，AI 巡增新标签后自动增多
  const [motifTags, setMotifTags] = useState<FacetVocab[]>([])
  useEffect(() => {
    facetAPI.list('motif').then(r => setMotifTags(r.items || [])).catch(() => setMotifTags([]))
  }, [])
  const [cwExtra, setCwExtra] = useState('')
  const [genBaseId, setGenBaseId] = useState('')

  // ── 发散边界（生成配方的一部分：orbit 强度 + edge 类别）──
  const [divergenceLevel, setDivergenceLevel] = useState<'conservative' | 'standard' | 'expansive'>('standard')
  const [edgeEnabled, setEdgeEnabled] = useState(false)
  const [edgeCats, setEdgeCats] = useState<Record<string, boolean>>({
    '科学探究精神/价值观': false, '合作与倾听（行为准则）': false, '文化认同与家国情怀': false,
  })

  // ── 课前问诊 ──
  const [consultQuestions, setConsultQuestions] = useState<ConsultQuestion[]>([])
  const [consultAnswers, setConsultAnswers] = useState<Record<string, string>>({})
  const [consultLoading, setConsultLoading] = useState(false)

  // 课前问诊：进页拉一次
  // （原为组件内 mount-only effect，逐行搬迁；依赖仍为 [] —— 只在挂载时用当时的课题/知识点问一次，
  //   草稿异步加载完成后的回填不触发重问，这是既有行为，搬迁不改。）
  useEffect(() => {
    if (consultQuestions.length > 0 || consultLoading) return
    setConsultLoading(true)
    const scope = buildKnowledgeScope(picker)
    aiAPI.consultCourseware({
      subject, grade: gradeName, lesson_title: genTitle.trim(),
      knowledge_points: scope.knowledge_points,
    }).then((r: any) => setConsultQuestions(r.questions || []))
      .catch(() => setConsultQuestions([]))
      .finally(() => setConsultLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    genTitle, setGenTitle,
    genStyleTag, setGenStyleTag,
    genStyleProfile, setGenStyleProfile,
    motifTags, setMotifTags,
    cwExtra, setCwExtra,
    genBaseId, setGenBaseId,
    divergenceLevel, setDivergenceLevel,
    edgeEnabled, setEdgeEnabled,
    edgeCats, setEdgeCats,
    consultQuestions, setConsultQuestions,
    consultAnswers, setConsultAnswers,
    consultLoading, setConsultLoading,
  }
}
