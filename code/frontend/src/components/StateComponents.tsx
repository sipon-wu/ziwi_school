/** 通用状态组件：Loading / Empty / Error / Disabled */
import { Loader2, AlertCircle, FileX, RefreshCw, XCircle, X } from 'lucide-react'

// ═══ Loading 骨架 ═══

export function LoadingSpinner({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Loader2 size={32} className="animate-spin mb-3 text-brand" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-2 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 表格骨架屏（匹配 base.css skeleton-row 动画） */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 py-3 border-b border-[#FAFAFA]">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="skeleton-pulse h-3.5 rounded flex-1"
              style={{ maxWidth: j === 0 ? 200 : j === 1 ? 60 : j === 3 ? 100 : 'auto' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ═══ 空状态 ═══

export function EmptyState({
  icon, title = '暂无数据', description, action,
}: {
  icon?: React.ReactNode
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="text-gray-300 mb-4">
        {icon || <FileX size={48} strokeWidth={1} />}
      </div>
      <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-400 mb-4 max-w-xs">{description}</p>}
      {action && (
        <button onClick={action.onClick}
          className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-hover">
          {action.label}
        </button>
      )}
    </div>
  )
}

// ── 错误状态 ──

export function ErrorState({
  message = '加载失败，请稍后重试',
  detail, onRetry,
}: {
  message?: string
  detail?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <XCircle size={28} className="text-red-400" />
      </div>
      <h3 className="text-sm font-medium text-gray-700 mb-1">{message}</h3>
      {detail && <p className="text-xs text-gray-400 mb-4 max-w-xs">{detail}</p>}
      {onRetry && (
        <button onClick={onRetry}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} /> 重试
        </button>
      )}
    </div>
  )
}

// ── 网络错误提示 ──

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white text-center py-2 text-xs font-medium animate-in slide-in-from-top">
      <div className="flex items-center justify-center gap-2">
        <AlertCircle size={14} />
        网络连接失败，请检查网络后
        {onRetry && <button onClick={onRetry} className="underline ml-1">重试</button>}
      </div>
    </div>
  )
}

// ═══ 可关闭通知条 ═══

export function NoticeBar({
  children, onClose, className = '',
}: {
  children: React.ReactNode; onClose?: () => void; className?: string
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 bg-white border border-border rounded mb-4 text-[13px] ${className}`}>
      <span className="text-gray-400">{children}</span>
      {onClose && <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-base px-1"><X size={14} /></button>}
    </div>
  )
}

// ═══ 表单错误 ═══

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <div className="text-xs text-danger mt-1">⚠ {message}</div>
}

// ── PageShell: 组合 loading/empty/error ──

export function PageShell({
  loading, error, empty, onRetry, children,
}: {
  loading: boolean
  error: string | null
  empty: boolean
  onRetry?: () => void
  children: React.ReactNode
}) {
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (empty) return <EmptyState title="暂无数据" description="当前没有可显示的内容" />
  return <>{children}</>
}
