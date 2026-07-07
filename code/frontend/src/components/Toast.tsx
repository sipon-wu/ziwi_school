import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast { id: number; type: ToastType; message: string }

interface ContextValue { toast: (message: string, type?: ToastType) => void }

const ToastCtx = createContext<ContextValue>({ toast: () => {} })
export const useToast = () => useContext(ToastCtx)

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={16} />,
  error: <XCircle size={16} />,
  warning: <AlertTriangle size={16} />,
  info: <Info size={16} />,
}
const COLORS: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
}

let nextId = 0

export type { ToastType }

// 全局 toast（供非组件文件使用）
let globalToast: ((msg: string, type?: ToastType) => void) | null = null
export const showToast = (msg: string, type: ToastType = 'info') => globalToast?.(msg, type)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId
    setList(prev => [...prev.slice(-4), { id, type, message }])
    setTimeout(() => setList(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  // 暴露全局
  useEffect(() => { globalToast = toast; return () => { globalToast = null } }, [toast])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {list.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-[4px] border shadow-lg text-[13px] font-medium animate-slide-in ${COLORS[t.type]}`}>
            {ICONS[t.type]}
            <span>{t.message}</span>
            <button onClick={() => setList(prev => prev.filter(x => x.id !== t.id))} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
