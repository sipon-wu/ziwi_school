import { Sparkles, Edit3, Check, X } from 'lucide-react'

/**
 * AiPreviewBadge — AI 预览态标识组件
 *
 * 统一的 AI 生成→预览→编辑→确认→保存五步流程标识。
 * 用于：
 * - ExerciseGenerator 生成的题目卡片
 * - LessonPlanEditor 生成的教案区块
 * - 批阅页 AI 评分区域
 */

export interface AiPreviewBadgeProps {
  /** 是否为 AI 预览态（显示黄色边框 + AI 标签） */
  preview?: boolean
  /** 预览态已确认（教师点击"确认"后） */
  confirmed?: boolean
  /** 点击确认回调 */
  onConfirm?: () => void
  /** 点击进入编辑模式回调 */
  onEdit?: () => void
  /** 点击取消/撤销 AI 内容回调 */
  onCancel?: () => void
  /** 确认按钮文字（默认"确认"） */
  confirmLabel?: string
  /** AI 标签文字（默认"AI 预览"） */
  badgeLabel?: string
  /** 自定义类名 */
  className?: string
  /** 子元素 */
  children?: React.ReactNode
}

export default function AiPreviewBadge({
  preview = false,
  confirmed = false,
  onConfirm,
  onEdit,
  onCancel,
  confirmLabel = '确认',
  badgeLabel = 'AI 预览',
  className = '',
  children,
}: AiPreviewBadgeProps) {
  if (!preview && !confirmed) {
    return <>{children}</>
  }

  const borderColor = confirmed
    ? 'border-green-200 ring-green-50'
    : 'border-amber-300 ring-amber-50 bg-amber-50/30'

  const badgeColor = confirmed
    ? 'bg-green-500 text-white'
    : 'bg-amber-500 text-white'

  const badgeText = confirmed ? '已确认' : badgeLabel

  return (
    <div className={`relative rounded-xl border-2 ${borderColor} ring-2 transition-all ${className}`}>
      {/* AI 标签 */}
      <div className={`absolute -top-2.5 left-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${badgeColor}`}>
        <Sparkles size={10} />
        {badgeText}
      </div>

      {/* 操作按钮组 */}
      {(preview || confirmed) && (
        <div className="absolute -top-2.5 right-3 flex items-center gap-1">
          {preview && onConfirm && (
            <button
              onClick={onConfirm}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-500 text-white rounded-full shadow-sm hover:bg-green-600 transition-colors"
            >
              <Check size={10} />
              {confirmLabel}
            </button>
          )}
          {preview && onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-white text-gray-600 border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Edit3 size={10} />
              编辑
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
              title="取消此内容"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}

      {/* 子内容 */}
      {children}
    </div>
  )
}

/**
 * AiSectionHeader — 教案/出题的 AI 生成区块标题
 * 显示 Sparkles 图标 + "AI 生成" 标记
 */
export function AiSectionHeader({
  label,
  confirmed,
  showBadge,
}: {
  label: string
  confirmed?: boolean
  showBadge?: boolean
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[13px] font-semibold text-gray-700">{label}</span>
      {showBadge && (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          confirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          <Sparkles size={9} />
          {confirmed ? '已确认' : 'AI 生成'}
        </span>
      )}
    </div>
  )
}
