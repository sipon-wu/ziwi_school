import { type ReactNode } from 'react'
import HeaderRight from './HeaderRight'
import LogoText from './LogoText'

interface Props {
  /** 左侧表单区（基本信息表单） */
  left: ReactNode
  /** 右侧图谱区 */
  right: ReactNode
  /** 副标题文字，居中显示 */
  subtitle?: string
}

export default function EditorLayout({ left, right, subtitle }: Props) {
  return (
    <div className="flex flex-col h-screen bg-[#F6F7F8]">
      {/* Header — logo 左边距与 AppLayout 侧边栏一致: pl-3 (12px) */}
      <header className="h-12 bg-[#212529] flex items-center pl-3 pr-5 shrink-0">
        {/* Left: Logo + 标题 */}
        <LogoText>
          <span className="font-normal ml-1"> - 工作台</span>
        </LogoText>

        {/* Center: 副标题文字，水平居中 */}
        <div className="flex-1 flex justify-center">
          <span className="text-white/40 text-[11px] hidden sm:inline">{subtitle || 'AI辅助生成结构化教案，支持课标自动对齐'}</span>
        </div>

        {/* Right: Token + Bell + Avatar */}
        <HeaderRight variant="dark" />
      </header>

      {/* Main Content: Left(340px form) + Right(flex-1 knowledge graph) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-[466px] bg-white border-r border-[#E7E7EB] flex flex-col shrink-0">
          {left}
        </div>

        {/* Right Panel */}
        <div className="flex-1 bg-white overflow-hidden flex flex-col">
          {right}
        </div>
      </div>
    </div>
  )
}
