import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, RotateCcw, Send } from 'lucide-react'

export default function ParentSignPage() {
  const nav = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [signed, setSigned] = useState(false)

  const startDraw = (e: React.TouchEvent|React.MouseEvent) => {
    setDrawing(true)
    const canvas = canvasRef.current
    if(!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e.nativeEvent)
      ? (e.nativeEvent as TouchEvent).touches[0].clientX - rect.left
      : (e.nativeEvent as MouseEvent).clientX - rect.left
    const y = ('touches' in e.nativeEvent)
      ? (e.nativeEvent as TouchEvent).touches[0].clientY - rect.top
      : (e.nativeEvent as MouseEvent).clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = '#1A3A6B'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    setHasSignature(true)
  }

  const doDraw = (e: React.TouchEvent|React.MouseEvent) => {
    if(!drawing) return
    const canvas = canvasRef.current
    if(!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e.nativeEvent)
      ? (e.nativeEvent as TouchEvent).touches[0].clientX - rect.left
      : (e.nativeEvent as MouseEvent).clientX - rect.left
    const y = ('touches' in e.nativeEvent)
      ? (e.nativeEvent as TouchEvent).touches[0].clientY - rect.top
      : (e.nativeEvent as MouseEvent).clientY - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDraw = () => {setDrawing(false)}
  const clearSignature = () => {
    const canvas = canvasRef.current
    if(!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0,0,canvas.width,canvas.height)
    setHasSignature(false)
  }

  const handleSign = () => {
    if(!hasSignature) return
    setSigned(true)
  }

  if(signed) return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
      <div className="text-center w-full">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={40} className="text-green-500"/>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">签字成功</h2>
        <p className="text-sm text-gray-500 mb-2">作业确认已完成</p>
        <p className="text-xs text-gray-400 mb-6">老师将收到您已签字的通知</p>
        <button onClick={()=>nav('/m/parent')} className="w-full py-3 bg-[#1A3A6B] text-white rounded-xl text-sm shadow-md active:bg-[#2B5DA8]">返回作业列表</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-6">
      {/* 作业信息 */}
      <div className="bg-white px-4 py-5 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900 mb-2">作业确认签字</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-400">作业名称</span><span className="text-gray-700">分数加减法练习</span></div>
          <div className="flex justify-between"><span className="text-gray-400">学校名称</span><span className="text-gray-700">示例小学</span></div>
          <div className="flex justify-between"><span className="text-gray-400">学生姓名</span><span className="text-gray-700">李明 · 三年级2班</span></div>
          <div className="flex justify-between"><span className="text-gray-400">得分</span><span className="font-bold text-[#1A3A6B]">85分</span></div>
          <div className="flex justify-between"><span className="text-gray-400">提交日期</span><span className="text-gray-700">2026-06-17</span></div>
        </div>
      </div>

      {/* 签字区 */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">请在下方签名</span>
          <button onClick={clearSignature} className="flex items-center gap-1 text-xs text-gray-400 active:text-red-500">
            <RotateCcw size={12}/> 清除
          </button>
        </div>
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={360}
            height={200}
            onTouchStart={startDraw}
            onTouchMove={doDraw}
            onTouchEnd={endDraw}
            onMouseDown={startDraw}
            onMouseMove={doDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            className="w-full h-[200px] cursor-crosshair bg-gray-50 border-b-2 border-dashed border-gray-200"
          />
          <div className="absolute bottom-3 right-3 text-[10px] text-gray-300 pointer-events-none">签名区</div>
        </div>
      </div>

      {/* 确认区 */}
      <div className="mx-4 mt-6">
        <label className="flex items-start gap-2 text-xs text-gray-500 mb-4">
          <input type="checkbox" className="mt-0.5 accent-[#1A3A6B]" defaultChecked/>
          <span>我已确认以上信息，知悉孩子的作业完成情况</span>
        </label>
        <button
          onClick={handleSign}
          disabled={!hasSignature}
          className="w-full py-3.5 bg-[#1A3A6B] text-white rounded-xl text-sm font-medium shadow-md active:bg-[#2B5DA8] disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Send size={16}/>确认签字
        </button>
      </div>
    </div>
  )
}
