import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'
type Toast = { id: number; type: ToastType; message: string }

const ToastCtx = createContext<{ toast: (type: ToastType, message: string) => void }>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastCtx)
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((type: ToastType, message: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {/* Toast 容器 */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right ${
              t.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              t.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {t.type === 'success' ? <CheckCircle size={16} /> :
             t.type === 'error' ? <XCircle size={16} /> :
             <AlertTriangle size={16} />}
            {t.message}
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-2 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
