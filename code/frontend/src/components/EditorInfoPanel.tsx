import { type ReactNode, useState } from 'react'
import { useTeaching } from '../lib/TeachingContext'
import XiaoWeiLauncher from './XiaoWeiLauncher'

/**
 * P0-3 左栏容器（务实克制版）：通用原子件 + 产品特定表单 children 注入。
 * 消除各页重复的左栏滚动容器 / 小微景版(opacity) / 小微入口样板。
 * 不强行统一字段：基本信息卡只渲染最通用的 学科/班级/教材卡，
 * 年级/进度条/命题用途/模板/标签 等产品特定字段由 children 注入。
 * 字段值归属（P0-3 A）：学科/年级/教材版本 走 TeachingContext；班级展示名由页面传入。
 */
interface XiaoweiCfg {
  contextType: string
  subject: string
  grade: string | number
  knowledgeNodeNames: string[]
  extraRequirements?: string
  onApply: (ctx: string) => void
}

interface Props {
  /** 基本信息卡是否显示，默认 true */
  showBasicInfo?: boolean
  /** 班级展示名（页面加载班级列表后传入） */
  classLabel?: string
  /** 是否在基本信息卡显示年级（出题页用；教案/组卷默认不显示） */
  showGrade?: boolean
  /** 框架级小微配置（P0-4） */
  xiaowei: XiaoweiCfg
  /** 产品特定表单主体（标题/单元课时/模板/知识点/标签/关联课件/附加要求 等） */
  children: ReactNode
}

const GRADE_NAMES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级']

function BasicInfoCard({ classLabel, showGrade }: { classLabel?: string; showGrade?: boolean }) {
  const teaching = useTeaching()
  const gradeName = GRADE_NAMES[teaching.grade - 1] || `${teaching.grade}年级`
  return (
    <div className="px-5 py-3">
      <h3 className="text-[13px] font-semibold text-[#353535] mb-3">基本信息</h3>
      <div className="flex gap-4">
        <div className="space-y-2 text-[12px] flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[#9A9A9A] w-8">学科</span>
            <span className="text-[#353535]">{teaching.subject}</span>
          </div>
          {showGrade && (
            <div className="flex items-center gap-2">
              <span className="text-[#9A9A9A] w-8">年级</span>
              <span className="text-[#353535]">{gradeName}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[#9A9A9A] w-8">班级</span>
            <span className="text-[#353535]">{classLabel || '—'}</span>
          </div>
        </div>
        <div className="w-[80px] h-[100px] bg-gray-100 rounded-[4px] border border-[#E7E7EB] flex items-center justify-center text-[11px] text-[#9A9A9A] text-center">
          {teaching.currentTextbook() || '人教版'}<br />{gradeName}{teaching.semester || '下'}册
        </div>
      </div>
    </div>
  )
}

export default function EditorInfoPanel({ showBasicInfo = true, classLabel, showGrade, xiaowei, children }: Props) {
  const [showXW, setShowXW] = useState(false)
  return (
    <div className="flex flex-col h-full">
      {/* Scrollable form area — 小微展开时变半透明景版（P0-3/P0-4 合并处理） */}
      <div className={`flex-1 overflow-y-auto ${showXW ? 'opacity-30 pointer-events-none select-none' : ''}`}>
        {showBasicInfo && <BasicInfoCard classLabel={classLabel} showGrade={showGrade} />}
        {children}
      </div>

      {/* 底部框架级小微入口（P0-4） */}
      <XiaoWeiLauncher
        open={showXW}
        onToggle={() => setShowXW(v => !v)}
        contextType={xiaowei.contextType}
        subject={xiaowei.subject}
        grade={xiaowei.grade}
        knowledgeNodeNames={xiaowei.knowledgeNodeNames}
        extraRequirements={xiaowei.extraRequirements}
        onApply={xiaowei.onApply}
      />
    </div>
  )
}
