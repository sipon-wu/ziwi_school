import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDialog({ open, title, message, confirmLabel = '确认', cancelLabel = '取消', danger = false, onConfirm, onCancel, loading = false }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle size={20} className={danger ? 'text-red-500' : 'text-amber-500'} />
          </div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6 ml-[52px]">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1A3A6B] hover:bg-[#2B5DA8]'
            }`}>
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
