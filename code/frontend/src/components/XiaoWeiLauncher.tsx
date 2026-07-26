import { type ReactNode } from 'react'
import EditXiaoWeiPanel from './EditXiaoWeiPanel'

/**
 * P0-4 框架级小微入口（受控）。
 * 沿用现有"左侧原地上延 + 常驻入口条"交互，消除各页重复的小微入口/面板/景版样板。
 * - 展开会话面板时面板外发光（P0-4），入口按钮不发光。
 * - 景版(opacity)由父容器（EditorInfoPanel）根据 open 控制，本组件只负责面板+发光+入口。
 */
interface Props {
  open: boolean
  onToggle: () => void
  /** 应用到当前内容：关闭面板 + 携带对话上下文触发 AI 生成 */
  onApply: (chatContext: string) => void
  contextType: string
  subject: string
  /** 原 EditXiaoWeiPanel 接收 subject/grade 字符串（如"四年级"），故此处兼容 string | number 透传 */
  grade: string | number
  knowledgeNodeNames: string[]
  extraRequirements?: string
  /** 入口按钮自定义内容，默认常驻深色条 */
  children?: ReactNode
  /** 隐藏自带入口按钮（入口由外部如 footer 控制，仅渲染展开面板+发光）。默认 false */
  hideEntry?: boolean
}

export default function XiaoWeiLauncher({
  open, onToggle, onApply, contextType, subject, grade, knowledgeNodeNames, extraRequirements, children, hideEntry,
}: Props) {
  return (
    <>
      {open ? (
        /* 展开态：只显示面板（宽度收缩对齐入口按钮，mx-5 与入口按钮 px-5 等宽；不写 w-full 避免 flex 子元素 100%+margin 溢出右侧） */
        <div
          className="max-h-[360px] z-20 bg-white flex flex-col shrink-0 rounded-t-[10px] overflow-hidden mx-5"
          style={{ boxShadow: '0 0 0 3px rgba(2,167,240,0.45), 0 0 24px 4px rgba(2,167,240,0.35)' }}
        >
          <EditXiaoWeiPanel
            contextType={contextType as 'lesson' | 'exercise' | 'exam'}
            subject={subject}
            grade={String(grade)}
            knowledgeNodeNames={knowledgeNodeNames}
            extraRequirements={extraRequirements || ''}
            onApply={(ctx: string) => { onToggle(); onApply(ctx) }}
            onCollapse={onToggle}
          />
        </div>
      ) : !hideEntry ? (
        /* 收起态：只显示入口条 */
        <div className="px-5 py-3 border-t border-[#F0F0F0] bg-white shrink-0">
          <button
            onClick={onToggle}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#353535] rounded-[4px] hover:bg-[#1A1A1A] transition-colors text-left"
          >
            {children || (
              <>
                <span className="flex-1 text-[12px] text-[#9A9A9A]">请补充要求，支持会话、附件上传、在线素材…</span>
                <img
                  src="/xiaowei.png"
                  alt="小微"
                  className="w-5 h-5 rounded-full shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </>
            )}
          </button>
        </div>
      ) : null}
    </>
  )
}
