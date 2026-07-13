import { useMemo } from 'react'
import { Target, BookOpen, ListOrdered, PenTool, ClipboardList, Lightbulb } from 'lucide-react'

interface StructuredContent {
  objectives?: string[] | { knowledge?: string; skill?: string; emotion?: string; [k: string]: any }
  keyPoints?: string[]
  key_points?: string[]
  difficultPoints?: string[]
  difficulties?: string[]
  preparation?: string[] | string
  process?: ProcessBlock[]
  blackboardDesign?: string
  blackboard_design?: string
  homework?: string
  reflection?: string
}

interface ProcessBlock {
  step?: number
  phase?: string
  type?: string
  title?: string
  duration?: number
  content?: string
  materials?: string[]
}

export default function LessonPlanContent({ content }: { content: string }) {
  const parsed = useMemo(() => parseContent(content), [content])

  if (parsed.type === 'empty') {
    return <span className="text-[#9A9A9A]">暂无内容</span>
  }

  if (parsed.type === 'markdown') {
    return <MarkdownView content={parsed.data as string} />
  }

  return <StructuredView data={parsed.data as StructuredContent} />
}

function parseContent(raw: string): { type: 'structured' | 'markdown' | 'empty'; data: StructuredContent | string } {
  if (!raw || !raw.trim()) return { type: 'empty', data: '' }
  const trimmed = raw.trim()
  if (trimmed === '{}' || trimmed === '[]' || trimmed === '""') return { type: 'empty', data: '' }

  // 尝试解析为结构化 JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        // 只要包含教学目标/教学过程/重难点等任意字段，就按结构化渲染
        const hasStructuredFields =
          obj.objectives !== undefined ||
          obj.process !== undefined ||
          obj.keyPoints !== undefined ||
          obj.key_points !== undefined ||
          obj.difficultPoints !== undefined ||
          obj.difficulties !== undefined ||
          obj.blackboardDesign !== undefined ||
          obj.blackboard_design !== undefined ||
          obj.homework !== undefined ||
          obj.reflection !== undefined
        if (hasStructuredFields) return { type: 'structured', data: obj }
      }
    } catch {
      // 解析失败，fallback 到 markdown
    }
  }

  return { type: 'markdown', data: raw }
}

function StructuredView({ data }: { data: StructuredContent }) {
  const objectives = normalizeObjectives(data.objectives)
  const keyPoints = arrayOf(data.keyPoints || data.key_points)
  const difficultPoints = arrayOf(data.difficultPoints || data.difficulties)
  const process = Array.isArray(data.process) ? data.process : []
  const blackboard = data.blackboardDesign || data.blackboard_design || ''
  const homework = data.homework || ''
  const reflection = data.reflection || ''
  const preparation = arrayOf(data.preparation)

  return (
    <div className="space-y-6">
      {objectives.length > 0 && (
        <Section icon={<Target size={15} />} title="教学目标">
          <ul className="space-y-2">
            {objectives.map((o, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
                <span className="text-[#02A7F0] font-medium shrink-0">{o.label}</span>
                <span className="text-[#353535]">{o.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(keyPoints.length > 0 || difficultPoints.length > 0) && (
        <Section icon={<Lightbulb size={15} />} title="教学重难点">
          <div className="grid md:grid-cols-2 gap-4">
            {keyPoints.length > 0 && (
              <div>
                <p className="text-[12px] text-[#9A9A9A] mb-1">重点</p>
                <ul className="list-disc list-inside text-[13px] text-[#353535] space-y-1">
                  {keyPoints.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
            {difficultPoints.length > 0 && (
              <div>
                <p className="text-[12px] text-[#9A9A9A] mb-1">难点</p>
                <ul className="list-disc list-inside text-[13px] text-[#353535] space-y-1">
                  {difficultPoints.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {preparation.length > 0 && (
        <Section icon={<ClipboardList size={15} />} title="教学准备">
          <ul className="list-disc list-inside text-[13px] text-[#353535] space-y-1">
            {preparation.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </Section>
      )}

      {process.length > 0 && (
        <Section icon={<ListOrdered size={15} />} title="教学过程">
          <div className="space-y-3">
            {process.map((p, i) => (
              <div key={i} className="border border-[#E7E7EB] rounded-[4px] p-3 bg-[#FAFAFA]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#02A7F0] text-white text-[10px] font-medium">
                    {p.step ?? i + 1}
                  </span>
                  <span className="text-[13px] font-medium text-[#353535]">
                    {p.phase || p.title || p.type || '环节'}
                  </span>
                  {p.duration ? (
                    <span className="ml-auto text-[11px] text-[#9A9A9A]">{p.duration} 分钟</span>
                  ) : null}
                </div>
                <p className="text-[13px] text-[#353535] leading-relaxed pl-7">{p.content || ''}</p>
                {Array.isArray(p.materials) && p.materials.length > 0 && (
                  <p className="text-[11px] text-[#9A9A9A] pl-7 mt-1.5">素材：{p.materials.join('、')}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {blackboard && (
        <Section icon={<PenTool size={15} />} title="板书设计">
          <div className="text-[13px] text-[#353535] leading-relaxed whitespace-pre-wrap bg-[#FAFAFA] border border-[#E7E7EB] rounded-[4px] p-3">{blackboard}</div>
        </Section>
      )}

      {homework && (
        <Section icon={<BookOpen size={15} />} title="作业布置">
          <p className="text-[13px] text-[#353535] leading-relaxed whitespace-pre-wrap">{homework}</p>
        </Section>
      )}

      {reflection && (
        <Section icon={<ClipboardList size={15} />} title="教学反思">
          <p className="text-[13px] text-[#353535] leading-relaxed whitespace-pre-wrap">{reflection}</p>
        </Section>
      )}
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#E7E7EB] rounded-[4px] overflow-hidden">
      <div className="px-4 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center gap-2">
        <span className="text-[#02A7F0]">{icon}</span>
        <span className="text-[13px] font-semibold text-[#353535]">{title}</span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function MarkdownView({ content }: { content: string }) {
  // 简单 markdown → HTML 渲染（避免引入第三方库）
  const html = useMemo(() => {
    return content
      .replace(/^######\s+(.+)$/gm, '<h6 class="text-[13px] font-bold text-[#353535] mt-4 mb-2">$1</h6>')
      .replace(/^#####\s+(.+)$/gm, '<h5 class="text-[13px] font-bold text-[#353535] mt-4 mb-2">$1</h5>')
      .replace(/^####\s+(.+)$/gm, '<h4 class="text-[14px] font-bold text-[#353535] mt-4 mb-2">$1</h4>')
      .replace(/^###\s+(.+)$/gm, '<h3 class="text-[15px] font-bold text-[#353535] mt-5 mb-3">$1</h3>')
      .replace(/^##\s+(.+)$/gm, '<h2 class="text-[16px] font-bold text-[#353535] mt-6 mb-3 border-b border-[#E7E7EB] pb-2">$1</h2>')
      .replace(/^#\s+(.+)$/gm, '<h1 class="text-[18px] font-bold text-[#353535] mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="bg-[#F6F7F8] px-1 py-0.5 rounded text-[12px] text-[#02A7F0]">$1</code>')
      .replace(/^\s*-\s+(.+)$/gm, '<li class="ml-5 list-disc text-[13px] text-[#353535] leading-relaxed">$1</li>')
      .replace(/^\s*(\d+)[.\)]\s+(.+)$/gm, '<li class="ml-5 list-decimal text-[13px] text-[#353535] leading-relaxed"><span class="font-medium">$1.</span> $2</li>')
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-[#F6F7F8] p-3 rounded-[4px] text-[12px] whitespace-pre-wrap my-3">$1</pre>')
      .replace(/\n/g, '<br/>')
  }, [content])

  return <div className="text-[14px] text-[#353535] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
}

function normalizeObjectives(obj: any): { label: string; text: string }[] {
  if (!obj) return []
  if (Array.isArray(obj)) return obj.map((t, i) => ({ label: `${i + 1}.`, text: String(t) }))
  if (typeof obj !== 'object') return []
  const labels: Record<string, string> = {
    knowledge: '知识与技能',
    skill: '过程与方法',
    emotion: '情感态度与价值观',
    ability: '能力培养',
    values: '价值观',
  }
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ({ label: labels[k] || k, text: String(v) }))
}

function arrayOf(value: any): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,，;；\n]/).map(s => s.trim()).filter(Boolean)
  return []
}
