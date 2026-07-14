import { type ReactNode } from 'react'
import HeaderRight from './HeaderRight'
import LogoText from './LogoText'

interface Props {
  /** 左侧表单区（基本信息表单） */
  left: ReactNode
  /** 右侧图谱区 / 编辑器 */
  right?: ReactNode
  /** 顶部中央的 Tab/工具 */
  topCenter?: ReactNode
}

export default function EditorLayout({ left, right, topCenter }: Props) {
  return (
    <div className="flex flex-col h-screen bg-[#F6F7F8]">
      {/* Header — logo 左边距与 AppLayout 侧边栏一致: pl-3 (12px) */}
      <header className="h-12 bg-[#212529] flex items-center pl-3 pr-5 shrink-0">
        {/* Left: Logo + 标题 */}
        <LogoText>
          <span className="font-normal ml-1"> - 工作台</span>
        </LogoText>

        {/* Center: Tab 等自定义内容 */}
        <div className="flex-1 flex justify-center">
          {topCenter}
        </div>

        {/* Right: Token + Bell + Avatar */}
        <HeaderRight variant="dark" />
      </header>

      {/* Main Content: Left(466px form) + Right(flex-1 knowledge graph / editor) */}
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
