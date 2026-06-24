import { createContext, useContext, useState } from 'react'
import type { UseKnowledgePickerReturn } from '@/hooks/useKnowledgePicker'

/**
 * 轻量级知识图谱状态共享上下文
 * 编辑器页面（LessonPlanEditor / ExerciseGenerator）通过此 Context 
 * 将 useKnowledgePicker 状态传递给 DashboardLayout 中的 KnowledgePanel。
 */
interface KGContextValue {
  picker: UseKnowledgePickerReturn | null
  setPicker: (p: UseKnowledgePickerReturn | null) => void
}

const KGContext = createContext<KGContextValue>({
  picker: null,
  setPicker: () => {},
})

export function KnowledgeGraphProvider({ children }: { children: React.ReactNode }) {
  const [picker, setPicker] = useState<UseKnowledgePickerReturn | null>(null)
  return (
    <KGContext.Provider value={{ picker, setPicker }}>
      {children}
    </KGContext.Provider>
  )
}

export function useKGContext() {
  return useContext(KGContext)
}
