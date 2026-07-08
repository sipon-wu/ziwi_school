import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Heart, TrendingUp, TrendingDown, Minus, FileText, MessageCircle, AlertCircle, Clock, CheckCircle2, Brain, Eye, ChevronDown, ChevronUp, ArrowLeft, Send, Sparkles, Pencil, Check, X, Plus } from 'lucide-react'
import { useTeaching } from '../lib/TeachingContext'
import { useToast } from '../components/Toast'
import AppLayout from '../components/AppLayout'

const GRADE_MAP: Record<number, string> = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级', 7: '七年级', 8: '八年级', 9: '九年级' }

// ── 单生详细数据 ──
type StudentDetail = {
  id: string; name: string; studentNo: string; gender: string; grade: number
  enrolledDate: string; status: 'activated' | 'pending'
  // 学业概览
  accuracy: number; accuracyTrend: 'up' | 'down' | 'flat'; accuracyChange: number
  accuracyHistory: { week: string; value: number }[]
  // 评估日志（时间倒序，最新在前，type: ai/teacher/mixed）
  assessments: { date: string; type: 'ai' | 'teacher' | 'mixed'; text: string }[]
  // 本周方案（§4.1-4.3）
  plan: {
    focusArea: string           // 本周聚焦，自然语言
    generatedAt: string         // 生成时间
    nextGeneration: string      // 下次自动生成（下周一06:00）
    status: 'draft' | 'confirmed' | 'executing'
    exercises: { title: string; type: string; tier: '基础' | '中等' | '挑战'; count: number; frequency: string; estimatedTime: string; reason: string; progress: number }[]
    tasks: { text: string; done: boolean }[]
    teacherNote: string
  } | null
  // 成长时间线
  timeline: { date: string; type: 'plan' | 'observation' | 'parent' | 'system'; source: '小微' | '教师' | '家长' | '系统'; text: string }[]
  // 家长沟通
  messages: { from: 'teacher' | 'parent'; time: string; text: string }[]
}

const STUDENT_DATA: Record<string, StudentDetail> = {
  s1: {
    id: 's1', name: '赵大鹏', studentNo: '20240007', gender: '男', grade: 4,
    enrolledDate: '2026-03-01', status: 'activated',
    accuracy: 68, accuracyTrend: 'up', accuracyChange: 6,
    accuracyHistory: [
      { week: '3月', value: 58 }, { week: '4月', value: 60 }, { week: '5月', value: 63 }, { week: '6月', value: 65 }, { week: '7月', value: 68 },
    ],
    assessments: [
      {
        date: '2026-07-05',
        type: 'mixed',
        text: '【小微评估】该生在分数比较题型上的正确率为52%，低于其自身前两周的68%。近期作业中，异分母分数比较的错误率较高，主要表现为通分步骤遗漏。计算基础题正确率稳定在75%以上，表明基础运算能力尚可，差距主要集中在应用题的理解转化环节。\n\n【教师观察】近期课堂专注度有所下降，后排座位时容易被同桌分散注意。上周面谈时该生表示"分数题目太绕了，读不懂。"本周调至前排后课堂互动频率明显提升。建议方案中增加"先读题再解题"的步骤引导，降低因阅读理解导致的失分。',
      },
      {
        date: '2026-06-28',
        type: 'mixed',
        text: '【小微评估】该生分数比较正确率从58%升至65%，呈上升趋势。通分步骤遗漏仍是主要问题，占错题原因的40%。应用题方面，题意理解正确率从45%升至55%，进步明显但仍有空间。\n\n【教师观察】该生本周课堂举手3次（上周为0次），课后主动问了一道分数比较题。虽然正确率仍偏低，但学习态度有明显转变。建议继续鼓励，不急于增加难度。',
      },
      {
        date: '2026-06-15',
        type: 'teacher',
        text: '与该生进行了10分钟课后谈话。了解到他对于"分数"这个概念本身有畏难情绪，主要原因是三年级时一次课堂提问答错后被同学笑了。这个心理因素比知识漏洞更需要关注。已安排每周一次"小老师"角色，让他给同桌讲解简单的分数题，逐步重建自信。',
      },
      {
        date: '2026-06-07',
        type: 'ai',
        text: '该生当前综合正确率60%，在班级中处于偏下水平。各题型中，分数比较类正确率最低（52%），远低于班级平均的78%。字词默写正确率85%，基础尚可。建议从同分母分数比较开始，难度逐级提升。',
      },
    ],
    plan: {
      focusArea: '异分母分数比较是当前薄弱环节，通分步骤需强化。同时需通过读题训练降低因题意理解导致的失分。',
      generatedAt: '2026-07-06（周一）06:00',
      nextGeneration: '2026-07-13（周一）06:00',
      status: 'executing',
      exercises: [
        { title: '异分母通分专项计算', type: '计算练习', tier: '中等', count: 14, frequency: '每周4次', estimatedTime: '每次10分钟', reason: '最新评估显示通分步骤遗漏占错题40%', progress: 85 },
        { title: '分数比较应用题（读题三步法）', type: '口算打卡', tier: '基础', count: 5, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '教师观察建议增加读题步骤引导', progress: 60 },
      ],
      tasks: [
        { text: '整理本周分数错题，分析错误原因，写在错题本上', done: true },
        { text: '课后找老师复述一遍"读题三步法"', done: false },
      ],
      teacherNote: '大鹏最近课堂状态明显好转，请家长在家多肯定他的进步。如果做题时遇到困难，建议让他先把题目朗读两遍再动手写。',
    },
    timeline: [
      { date: '2026-07-03', type: 'plan', source: '小微', text: '生成本周方案草案：分数比较专项 + 应用题读题三步法' },
      { date: '2026-07-02', type: 'observation', source: '教师', text: '补充观察：调至前排后课堂互动明显改善，建议持续观察' },
      { date: '2026-06-28', type: 'plan', source: '小微', text: '上周方案执行完成率 90%，正确率提升 3%' },
      { date: '2026-06-15', type: 'parent', source: '家长', text: '家长确认入组通知，并反馈孩子在家做练习时经常磨蹭' },
      { date: '2026-06-10', type: 'system', source: '系统', text: '向家长发送入组诊断书' },
      { date: '2026-06-08', type: 'observation', source: '教师', text: '教师观察：该生在分组讨论时参与度低，更倾向于独自做题' },
      { date: '2026-06-01', type: 'system', source: '系统', text: '教师从成长足迹勾选该生纳入成长关爱' },
    ],
    messages: [
      { from: 'teacher', time: '2026-07-03 14:30', text: '赵大鹏妈妈您好，本周给孩子安排了三项练习，重点在分数比较的解题思路。他最近课堂状态有明显好转，请您在家也多鼓励他。' },
      { from: 'parent', time: '2026-07-03 20:15', text: '谢谢张老师！最近在家做练习确实积极了一些，但还是需要有人在旁边盯着，不然容易走神。分数比较的错题我周末再陪他过一遍。' },
      { from: 'teacher', time: '2026-06-28 10:00', text: '上周练习完成得很好，正确率提升了3%。本周新加入了"读题三步法"的练习，主要是帮助他克服"读不懂题"的问题。' },
      { from: 'parent', time: '2026-06-28 19:00', text: '这个练习很有针对性，他确实经常说"看不懂题目什么意思"。我会按您说的步骤在家引导他。' },
    ],
  },
  s2: {
    id: 's2', name: '孙小飞', studentNo: '20240008', gender: '男', grade: 4,
    enrolledDate: '2026-03-15', status: 'activated',
    accuracy: 55, accuracyTrend: 'up', accuracyChange: 3,
    accuracyHistory: [
      { week: '3月', value: 48 }, { week: '4月', value: 50 }, { week: '5月', value: 52 }, { week: '6月', value: 53 }, { week: '7月', value: 55 },
    ],
    assessments: [
      { date: '2026-07-05', type: 'mixed', text: '【小微评估】该生目前在排比句运用上的正确率为45%，低于班级平均水平。近期仿写类题目中，句式结构不完整的情况占错题的60%以上。基础知识（字词默写）正确率稳定在80%，说明基础字词掌握较好，问题主要集中在表达类题型。\n\n【教师观察】该生性格内向，课堂上很少主动发言。上次作文课让他到黑板前写一个排比句，写出来的句子虽然简单但结构正确，说明他不是不会，是缺乏信心。建议在方案中增加"每日一句"的小任务，降低难度门槛，先建立自信心。' },
      { date: '2026-06-20', type: 'teacher', text: '课堂上第一次主动举手回答问题（虽然声音很小）。作文中出现了两个自己写的排比句，虽然有结构瑕疵但比之前完全仿写好很多。开始有独立创作的意识了。' },
      { date: '2026-06-07', type: 'ai', text: '该生排比句运用正确率仅为42%，句式结构不完整是主要问题。字词基础尚可，但表达类题型整体偏弱。' },
    ],
    plan: {
      focusArea: '排比句运用是当前最大薄弱项，句式结构不完整占错题60%以上。需从仿写过渡到独立创作，同时积累优质句式。',
      generatedAt: '2026-07-06（周一）06:00',
      nextGeneration: '2026-07-13（周一）06:00',
      status: 'executing',
      exercises: [
        { title: '排比句仿写（每日一句）', type: '口算打卡', tier: '基础', count: 20, frequency: '每周5次', estimatedTime: '每次10分钟', reason: '教师观察建议降低难度门槛，先建立信心', progress: 70 },
        { title: '课文精彩句式摘抄与分析', type: '专项训练', tier: '中等', count: 5, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '积累规范句式，为独立创作打基础', progress: 50 },
      ],
      tasks: [
        { text: '本周至少摘抄3篇课文中的排比句，标注句式特点', done: false },
        { text: '用排比句写一段"我的周末"，不少于4句', done: true },
      ],
      teacherNote: '小飞最近愿意开口了，这就是最大的进步。请家长在家鼓励他多读多写，不要急于纠正每个小错误，先保护他的表达欲望。',
    },
    timeline: [
      { date: '2026-07-03', type: 'plan', source: '小微', text: '生成方案：排比句专项 + 句式摘抄 + 片段练习' },
      { date: '2026-07-01', type: 'observation', source: '教师', text: '观察到该生在作文中首次独立使用了两个排比句，给予口头表扬' },
      { date: '2026-06-20', type: 'parent', source: '家长', text: '家长确认入组通知' },
      { date: '2026-06-15', type: 'system', source: '系统', text: '教师从成长足迹勾选该生纳入成长关爱' },
    ],
    messages: [
      { from: 'teacher', time: '2026-07-01 16:00', text: '孙小飞今天在作文中独立使用了排比句，进步很大！请家长在家也表扬一下他。' },
      { from: 'parent', time: '2026-07-01 20:00', text: '太好了！他在家最近也愿意多写几句了，虽然还是会问我"这样写对不对"，但比以前一句都不肯写强多了。感谢老师的耐心！' },
    ],
  },
  s3: {
    id: 's3', name: '钱小强', studentNo: '20240011', gender: '男', grade: 4,
    enrolledDate: '2026-04-10', status: 'activated',
    accuracy: 62, accuracyTrend: 'flat', accuracyChange: 0,
    accuracyHistory: [
      { week: '4月', value: 60 }, { week: '5月', value: 61 }, { week: '6月', value: 63 }, { week: '7月', value: 62 },
    ],
    assessments: [
      { date: '2026-07-05', type: 'mixed', text: '【小微评估】该生近三周成绩波动在±2%范围内，处于平台期。仿写表达类题目正确率维持在中位水平，无明显进步。但作业完成率从4月的78%降至6月的65%，说明练习量的减少可能是成绩停滞的重要原因。\n\n【教师观察】最近几周发现该生作业经常迟交或漏交。与家长沟通后了解到，这学期参加了校外足球训练，每周三次，回家后精力不足。已与家长协商将足球训练减少到每周两次，本周开始初见成效。' },
      { date: '2026-05-15', type: 'ai', text: '仿写表达正确率60%，按中等水平。作业完成率从78%开始下降，需关注。' },
    ],
    plan: {
      focusArea: '成绩处于平台期，当前首要目标是恢复练习量。已与家长协商减少课外训练，需持续观察作业完成率变化。',
      generatedAt: '2026-07-06（周一）06:00',
      nextGeneration: '2026-07-13（周一）06:00',
      status: 'executing',
      exercises: [
        { title: '仿写表达基础句式练习', type: '计算练习', tier: '基础', count: 5, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '评估显示练习量下降是停滞主因，先恢复节奏', progress: 40 },
      ],
      tasks: [
        { text: '本周至少3天放学后先完成作业再去玩', done: false },
        { text: '在错题本上整理本周仿写错误', done: true },
      ],
      teacherNote: '和小强沟通过，他自己也想提高成绩。请家长帮忙督促"先作业后足球"的节奏，等他恢复练习量后再看效果。',
    },
    timeline: [
      { date: '2026-07-03', type: 'plan', source: '小微', text: '方案调整：降低练习量，先保证作业完成率' },
      { date: '2026-06-25', type: 'observation', source: '教师', text: '与家长协商调整校外训练安排，本周开始实施' },
      { date: '2026-06-18', type: 'observation', source: '教师', text: '教师观察：多次作业迟交，与家长沟通后了解原因' },
      { date: '2026-05-10', type: 'parent', source: '家长', text: '家长确认入组通知' },
      { date: '2026-04-10', type: 'system', source: '系统', text: '教师从成长足迹勾选该生纳入成长关爱' },
    ],
    messages: [
      { from: 'teacher', time: '2026-06-25 15:00', text: '和家长沟通后，足球训练已调整为每周两次。本周作业完成率有所回升，继续保持。' },
      { from: 'parent', time: '2026-06-25 18:30', text: '是的，调整后感觉孩子没那么累了。我们会督促他先把作业做完再出去玩。' },
    ],
  },
  s4: { id: 's4', name: '冯小美', studentNo: '20240012', gender: '女', grade: 4, enrolledDate: '2026-04-20', status: 'pending', accuracy: 58, accuracyTrend: 'down', accuracyChange: 4, accuracyHistory: [{ week: '4月', value: 62 }, { week: '5月', value: 60 }, { week: '6月', value: 59 }, { week: '7月', value: 58 }], assessments: [{ date: '2026-04-20', type: 'ai', text: '该生当前正确率62%，在班级中处于中等偏下水平。多角度提问类题目正确率偏低，建议重点关注。' }], plan: { focusArea: '多角度提问能力需加强，当前正确率呈下降趋势，需及时干预。', generatedAt: '2026-04-20（入组即生成）', nextGeneration: '2026-07-13（周一）06:00', status: 'executing', exercises: [{ title: '多角度提问专项训练', type: '专项训练', tier: '基础', count: 10, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '多角度提问正确率偏低且呈下降趋势', progress: 55 }], tasks: [{ text: '每次练习后自评：是否用了至少2种角度提问', done: false }], teacherNote: '', }, timeline: [{ date: '2026-04-20', type: 'system', source: '系统', text: '教师从成长足迹勾选该生纳入成长关爱，方案已自动生成' }], messages: [] },
  s5: { id: 's5', name: '苗小光', studentNo: '20240045', gender: '男', grade: 4, enrolledDate: '2026-05-05', status: 'activated', accuracy: 71, accuracyTrend: 'up', accuracyChange: 8, accuracyHistory: [{ week: '5月', value: 63 }, { week: '6月', value: 67 }, { week: '7月', value: 71 }], assessments: [{ date: '2026-07-04', type: 'ai', text: '该生分数混合运算进步显著，近一个月正确率提升8%。运算顺序错误从高频降至偶发，已基本掌握先乘除后加减的规则。建议在维持当前节奏的基础上，逐步引入带括号的复杂运算。' }], plan: { focusArea: '分数混合运算进步显著，建议维持当前节奏，逐步引入带括号的复杂运算。', generatedAt: '2026-07-06（周一）06:00', nextGeneration: '2026-07-13（周一）06:00', status: 'executing', exercises: [{ title: '分数混合运算巩固（含通分）', type: '计算练习', tier: '中等', count: 12, frequency: '每周4次', estimatedTime: '每次10分钟', reason: '运算顺序已基本掌握，巩固为主', progress: 90 }, { title: '带括号的复杂运算入门', type: '专项训练', tier: '挑战', count: 8, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '逐步引入新难度', progress: 75 }], tasks: [{ text: '完成本周混合运算错题整理', done: true }], teacherNote: '小光最近状态很好，请继续保持！下周会加一点括号运算的内容，难度不大。' }, timeline: [{ date: '2026-07-04', type: 'plan', source: '小微', text: '方案更新：混合运算巩固 + 括号优先级' }, { date: '2026-05-05', type: 'system', source: '系统', text: '纳入成长关爱' }], messages: [{ from: 'teacher', time: '2026-07-01', text: '苗小光进步很大，继续保持！' }, { from: 'parent', time: '2026-07-01', text: '感谢老师！我们在家也发现他做题更自信了。' }] },
  s6: { id: 's6', name: '花小玉', studentNo: '20240046', gender: '女', grade: 4, enrolledDate: '2026-06-01', status: 'pending', accuracy: 65, accuracyTrend: 'up', accuracyChange: 2, accuracyHistory: [{ week: '6月', value: 63 }, { week: '7月', value: 65 }], assessments: [{ date: '2026-06-01', type: 'ai', text: '该生当前正确率63%，词语理解类题目正确率低于班级平均。近期呈小幅上升趋势，建议持续观察。' }], plan: { focusArea: '词语理解能力有改善迹象，建议以巩固为主，辅以适当拓展。', generatedAt: '2026-06-01（入组即生成）', nextGeneration: '2026-07-13（周一）06:00', status: 'executing', exercises: [{ title: '词语理解与运用练习', type: '口算打卡', tier: '基础', count: 8, frequency: '每周3次', estimatedTime: '每次10分钟', reason: '正确率偏低但呈上升趋势，巩固为主', progress: 65 }], tasks: [{ text: '每天阅读一篇短文并标注生词', done: true }], teacherNote: '', }, timeline: [{ date: '2026-06-01', type: 'system', source: '系统', text: '纳入成长关爱，方案已自动生成' }], messages: [] },
  // 已移出学生：历史记录全保留
  s7: { id: 's7', name: '褚小刚', studentNo: '20240013', gender: '男', grade: 4, enrolledDate: '2026-02-15', status: 'removed' as any, accuracy: 76, accuracyTrend: 'up', accuracyChange: 4, accuracyHistory: [{ week: '2月', value: 61 }, { week: '3月', value: 65 }, { week: '4月', value: 70 }, { week: '5月', value: 73 }, { week: '6月', value: 76 }], assessments: [{ date: '2026-06-15', type: 'mixed', text: '【小微评估】该生正确率已稳定在75%以上，连续6周呈上升趋势，已从最初的61%提升至76%。分数比较、混合运算等核心题型正确率均超过班级平均。\n\n【教师观察】该生本学期进步显著，已具备自主学习能力。与家长沟通后一致认为可以结业移出关爱小组。' }, { date: '2026-02-15', type: 'ai', text: '该生初始正确率61%，分数比较和混合运算两类题型偏弱，纳入成长关爱。' }], plan: { focusArea: '该生已达标移出。', generatedAt: '2026-02-15（入组即生成）', nextGeneration: '已停止（2026-06-20移出）', status: 'executing', exercises: [], tasks: [], teacherNote: '', }, timeline: [{ date: '2026-06-20', type: 'system', source: '系统', text: '教师将该生移出关爱小组，方案生成停止。历史记录保留。' }, { date: '2026-06-15', type: 'plan', source: '小微', text: '综合评估：正确率达标，建议结业' }, { date: '2026-02-15', type: 'system', source: '系统', text: '纳入成长关爱' }], messages: [{ from: 'teacher', time: '2026-06-20', text: '褚小刚家长您好，孩子本学期进步很大，正确率从61%提升到76%，已达到预期目标。即日起移出关爱小组，后续如有需要可重新纳入。孩子这段时间的所有成长记录都会保留。' }, { from: 'parent', time: '2026-06-20', text: '感谢张老师这4个月的悉心指导！孩子的变化我们看在眼里，真的很感激。' }] },
}

const TYPE_STYLE: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  plan: { icon: FileText, color: '#722ED1', bg: '#F5F0FF' },
  observation: { icon: Eye, color: '#02A7F0', bg: '#E8F7FF' },
  parent: { icon: MessageCircle, color: '#52C41A', bg: '#F0FFE5' },
  system: { icon: CheckCircle2, color: '#9A9A9A', bg: '#F6F7F8' },
}

export default function CareDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const teaching = useTeaching()
  const gradeName = GRADE_MAP[teaching.grade] || '四年级'

  const [detail, setDetail] = useState(id ? STUDENT_DATA[id] : undefined)
  const { toast } = useToast()
  const [editFocus, setEditFocus] = useState(false)
  const [editNote, setEditNote] = useState(false)
  const [editFocusText, setEditFocusText] = useState('')
  const [editNoteText, setEditNoteText] = useState('')
  const [showAddAssess, setShowAddAssess] = useState(false)
  const [newAssess, setNewAssess] = useState({ text: '', type: 'teacher' as const })

  useEffect(() => { setDetail(id ? STUDENT_DATA[id] : undefined) }, [id])
  const s = detail
  const [activeTab, setActiveTab] = useState<'overview' | 'messages'>('overview')
  const [msgText, setMsgText] = useState('')
  const [showKindnessReview, setShowKindnessReview] = useState(false)

  const startEditFocus = () => { if (!s) return; setEditFocusText((s as any).plan.focusArea); setEditFocus(true) }
  const saveFocus = () => { if (!s) return; setDetail({ ...s, plan: { ...(s as any).plan, focusArea: editFocusText } } as any); setEditFocus(false); 
    const blocked = ['最差','最笨','不行','没救','比所有人都']
    const hasBlocked = blocked.some(w => editFocusText.includes(w))
    if (hasBlocked) { toast('⚠️ 请避免绝对化或比较性表述，使用建设性建议', 'warning'); return }
    toast('关注点已更新', 'success'); if (id) { const d = JSON.parse(localStorage.getItem('care_edits')||'{}'); d[id] = { focusArea: editFocusText, ...d[id] }; localStorage.setItem('care_edits', JSON.stringify(d)) } }
  const startEditNote = () => { if (!s) return; setEditNoteText((s as any).plan.teacherNote || ''); setEditNote(true) }
  const saveNote = () => { if (!s) return; setDetail({ ...s, plan: { ...(s as any).plan, teacherNote: editNoteText } } as any); setEditNote(false); toast('备注已更新', 'success'); if (id) { const d = JSON.parse(localStorage.getItem('care_edits')||'{}'); d[id] = { teacherNote: editNoteText, ...d[id] }; localStorage.setItem('care_edits', JSON.stringify(d)) } }
  const addAssessment = () => {
    if (!s || !newAssess.text.trim()) return
    const today = new Date().toISOString().slice(0, 10)
    setDetail({ ...s, assessments: [{ date: today, type: newAssess.type, text: `【教师观察】${newAssess.text}` }, ...s.assessments] })
    setShowAddAssess(false); setNewAssess({ text: '', type: 'teacher' }); toast('评估已添加', 'success')
  }
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  if (!s) return <AppLayout><div className="p-8 text-center text-[#9A9A9A]">未找到该学生记录</div></AppLayout>

  const enrolledDays = Math.floor((Date.now() - new Date(s.enrolledDate).getTime()) / 86400000)
  const enrolledStr = enrolledDays < 30 ? `${enrolledDays}天` : `${Math.floor(enrolledDays / 30)}个月${enrolledDays % 30 > 0 ? `${enrolledDays % 30}天` : ''}`

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 顶部导航栏 */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/care')} className="text-[11px] text-[#02A7F0] hover:underline flex items-center gap-1">
            <ArrowLeft size={12} />返回列表
          </button>
          <span className="text-[#E7E7EB]">|</span>
          <span className="text-[13px] font-medium text-[#353535]">{s.name}</span>
          <span className="text-[10px] text-[#9A9A9A]">{s.studentNo} · {s.gender} · {gradeName}</span>
          {(s as any).status === 'removed' ? (
            <span className="text-[10px] text-[#9A9A9A] bg-[#F0F0F0] px-1.5 py-0.5 rounded">已移出关爱小组</span>
          ) : s.status === 'activated' ? (
            <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">家长已阅</span>
          ) : (
            <span className="text-[10px] text-[#9A9A9A] bg-[#F6F7F8] px-1.5 py-0.5 rounded">家长未读</span>
          )}
          {(s as any).status !== 'removed' && (
            <button onClick={() => setShowRemoveConfirm(true)} className="text-[9px] text-red-400 hover:text-red-500 hover:underline ml-2">移出关爱小组</button>
          )}
          <span className="text-[10px] text-[#9A9A9A] ml-auto">入组 {enrolledStr}</span>
        </div>

        {/* ── 正确率变化曲线 ── */}
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[12px] font-semibold text-[#353535]">正确率变化</span>
              <span className="text-[10px] text-[#9A9A9A] ml-2">入组以来</span>
            </div>
            <div className="flex items-center gap-1">
              {s.accuracyTrend === 'up' ? <TrendingUp size={13} className="text-green-600" /> : s.accuracyTrend === 'down' ? <TrendingDown size={13} className="text-red-500" /> : <Minus size={13} className="text-[#9A9A9A]" />}
              <span className={`text-[11px] font-medium ${s.accuracyTrend === 'up' ? 'text-green-600' : s.accuracyTrend === 'down' ? 'text-red-500' : 'text-[#9A9A9A]'}`}>
                {s.accuracyTrend !== 'flat' ? `${s.accuracyTrend === 'up' ? '+' : '-'}${s.accuracyChange}%` : '持平'}
              </span>
            </div>
          </div>
          {/* 简易折线图 */}
          <div className="h-24 flex items-end gap-2">
            {s.accuracyHistory.map((p, i) => {
              const maxV = Math.max(...s.accuracyHistory.map(x => x.value))
              const h = `${(p.value / maxV) * 100}%`
              const isLast = i === s.accuracyHistory.length - 1
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className={`text-[10px] font-bold ${isLast ? 'text-[#02A7F0]' : 'text-[#9A9A9A]'}`}>{p.value}%</span>
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full rounded-t-[3px] transition-all" style={{ height: h, background: isLast ? '#02A7F0' : '#D0D0D0' }} />
                  </div>
                  <span className="text-[9px] text-[#9A9A9A]">{p.week}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Tab 切换 ── */}
        <div className="flex items-center gap-0 bg-[#F0F0F0] rounded-[4px] p-0.5 w-fit">
          {[
            { id: 'overview' as const, label: '学情与方案', icon: Brain },
            { id: 'messages' as const, label: '家长沟通', icon: MessageCircle },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-[3px] transition-colors ${activeTab === t.id ? 'bg-white text-[#353535] shadow-sm' : 'text-[#9A9A9A] hover:text-[#353535]'}`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            {/* ── 评估日志（时间倒序） ── */}
            <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center gap-1.5">
                <Brain size={13} className="text-[#353535]" />
                <span className="text-[12px] font-semibold text-[#353535]">评估日志</span>
                <span className="text-[9px] text-[#9A9A9A] ml-auto">时间倒序 · 最新在前</span>
              </div>
              {s.assessments.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-[12px] text-[#9A9A9A]">暂无评估记录</p>
                  <p className="text-[10px] text-[#B0B0B0] mt-1">
                    {s.status !== 'activated' ? '家长确认入组后，小微将开始生成评估。' : '小微将于每周一自动生成学情评估，教师也可随时添加观察记录。'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F0F0F0]">
                  {s.assessments.map((a, i) => {
                    const isLatest = i === 0
                    const typeMeta = {
                      ai: { label: '小微评估', icon: Brain, color: '#722ED1', bg: '#F5F0FF' },
                      teacher: { label: '教师观察', icon: Eye, color: '#02A7F0', bg: '#E8F7FF' },
                      mixed: { label: '双评估', icon: FileText, color: '#353535', bg: '#F6F7F8' },
                    }[a.type]
                    return (
                      <div key={i} className={`px-4 py-3 ${isLatest ? 'bg-[#F9FAFB]' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1`} style={{ background: typeMeta.bg, color: typeMeta.color }}>
                            <typeMeta.icon size={10} />{typeMeta.label}
                          </span>
                          <span className="text-[10px] text-[#9A9A9A]">{a.date}</span>
                          {isLatest && <span className="text-[9px] text-green-600 bg-green-50 px-1 py-0.5 rounded">最新</span>}
                        </div>
                        <p className="text-[12px] text-[#595959] leading-relaxed whitespace-pre-line">{a.text}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── 本周提升方案（§4.1-4.3）── */}
            {(s as any).status === 'removed' && (
              /* 已移出提示 */
              <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden mb-0">
                <div className="p-4 bg-[#F9FAFB] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] text-[#595959]">
                    <Clock size={13} className="text-[#9A9A9A]" />
                    <span>该生已于 2026-06-20 移出关爱小组，方案生成已停止。历史记录完整保留。</span>
                  </div>
                  <button className="px-3 py-1.5 text-[11px] text-[#02A7F0] border border-[#02A7F0]/20 rounded-[4px] hover:bg-[#02A7F0]/5 shrink-0">重新纳入小组</button>
                </div>
              </div>
            )}

            <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center gap-1.5">
                <FileText size={13} className="text-[#353535]" />
                <span className="text-[12px] font-semibold text-[#353535]">本周提升方案</span>
                {(s as any).plan && (s as any).status !== 'removed' && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ml-auto ${(s as any).plan.status === 'executing' ? 'bg-green-50 text-green-600' : 'bg-[#F9FAFB] text-[#9A9A9A]'}`}>
                    {(s as any).plan.status === 'executing' ? '执行中' : (s as any).plan.status === 'draft' ? '待确认' : '已确认'}
                  </span>
                )}
                {(s as any).status === 'removed' && (s as any).plan && (
                  <span className="text-[9px] text-[#9A9A9A] bg-[#F0F0F0] px-1.5 py-0.5 rounded ml-auto">已停止</span>
                )}
                {!s.plan && (
                  <span className="text-[9px] text-[#9A9A9A] ml-auto">入组后将立即生成</span>
                )}
              </div>

              {!s.plan ? (
                /* 尚未入组：不应出现此状态 */
                <div className="p-6 text-center">
                  <Sparkles size={24} className="mx-auto text-[#722ED1]/30 mb-2" />
                  <p className="text-[12px] text-[#9A9A9A]">入组即生成方案</p>
                  <p className="text-[10px] text-[#B0B0B0] mt-1">教师勾选学生纳入成长关爱后，小微将立即生成首份个性化方案</p>
                  <div className="mt-3 text-[10px] text-[#722ED1] bg-[#F5F0FF] px-2.5 py-1 rounded inline-flex items-center gap-1.5">
                    <Sparkles size={11} />即时生成，无需等待
                  </div>
                </div>
              ) : !s.plan ? (
                /* 无方案（理论上不会出现此状态） */
                <div className="p-4 text-center">
                  <p className="text-[12px] text-[#9A9A9A]">入组即生成方案，无需等待。</p>
                  <p className="text-[10px] text-[#B0B0B0] mt-1">后续方案将于每周一 06:00 自动更新。</p>
                </div>
              ) : (
                /* 已有方案 */
                <div className="divide-y divide-[#F0F0F0]">
                  {/* 自动化状态条 */}
                  <div className="px-4 py-2 bg-[#FAFBFC] flex items-center gap-2 text-[10px] text-[#9A9A9A]">
                    <Clock size={11} />
                    <span>生成于 {s.plan.generatedAt}，下次自动生成 {s.plan.nextGeneration}</span>
                  </div>

                  {/* 本周聚焦 */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-[#9A9A9A]">本周聚焦</span><button onClick={startEditFocus} className="text-[10px] text-[#02A7F0] hover:underline flex items-center gap-0.5"><Pencil size={10} />编辑</button></div>
                    {editFocus ? (
                      <div className="flex items-start gap-2"><textarea value={editFocusText} onChange={e => setEditFocusText(e.target.value)} className="flex-1 px-2 py-1.5 text-[12px] border border-[#02A7F0] rounded-[3px] outline-none resize-none h-[60px]" autoFocus /><div className="flex flex-col gap-1"><button onClick={saveFocus} className="p-1 text-green-600"><Check size={13} /></button><button onClick={() => setEditFocus(false)} className="p-1 text-[#9A9A9A]"><X size={13} /></button></div></div>
                    ) : <p className="text-[12px] text-[#353535] leading-relaxed">{s.plan.focusArea}</p>}
                  </div>

                  {/* 练习安排 */}
                  <div className="px-4 py-3">
                    <div className="text-[10px] text-[#9A9A9A] mb-2">练习安排（{teaching.grade <= 6 ? '小学模式：计算练习 + 口算打卡，鼓励性语气' : '初中模式：专项训练 + 错题变式，目标导向'}）</div>
                    <div className="space-y-2">
                      {s.plan.exercises.map((ex, i) => {
                        const tierColors: Record<string, string> = { '基础': 'bg-blue-50 text-blue-600', '中等': 'bg-purple-50 text-purple-600', '挑战': 'bg-orange-50 text-orange-600' }
                        const typeColors: Record<string, string> = { '计算练习': 'bg-[#E8F7FF] text-[#02A7F0]', '口算打卡': 'bg-[#F0FFE5] text-[#52C41A]', '专项训练': 'bg-[#F5F0FF] text-[#722ED1]', '错题变式': 'bg-[#FFF7E6] text-[#FA8C16]' }
                        return (
                          <div key={i} className="p-3 bg-[#F9FAFB] rounded-[4px] border border-[#E7E7EB]">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[12px] font-medium text-[#353535]">{ex.title}</span>
                              <span className={`text-[8px] px-1 py-0.5 rounded ${typeColors[ex.type] || 'bg-[#F6F7F8] text-[#9A9A9A]'}`}>{ex.type}</span>
                              <span className={`text-[8px] px-1 py-0.5 rounded ${tierColors[ex.tier]}`}>{ex.tier}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-[#9A9A9A] mb-2">
                              <span>{ex.count}题</span>
                              <span className="text-[#E7E7EB]">|</span>
                              <span>{ex.frequency}</span>
                              <span className="text-[#E7E7EB]">|</span>
                              <span>{ex.estimatedTime}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-[#B0B0B0]">依据：{ex.reason}</span>
                              <div className="flex items-center gap-1.5">
                                <div className="w-14 h-1 bg-[#E7E7EB] rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${ex.progress >= 80 ? 'bg-green-400' : ex.progress >= 50 ? 'bg-[#02A7F0]' : 'bg-orange-300'}`} style={{ width: `${ex.progress}%` }} />
                                </div>
                                <span className="text-[10px] font-medium text-[#595959] w-6">{ex.progress}%</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 学习任务 */}
                  <div className="px-4 py-3">
                    <div className="text-[10px] text-[#9A9A9A] mb-1.5">学习任务</div>
                    <div className="space-y-1">
                      {s.plan.tasks.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-[12px]">
                          <span className={`${t.done ? 'text-green-500' : 'text-[#C0C0C0]'}`}>{t.done ? '☑' : '☐'}</span>
                          <span className={t.done ? 'text-[#9A9A9A] line-through' : 'text-[#353535]'}>{t.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 教师建议 */}
                  {s.plan.teacherNote && (
                    <div className="px-4 py-3">
                      <div className="text-[10px] text-[#9A9A9A] mb-1">教师建议（发送给家长）</div>
                      <p className="text-[12px] text-[#595959] leading-relaxed italic">"{s.plan.teacherNote}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 成长时间线 ── */}
            <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center gap-1.5">
                <Heart size={13} className="text-[#EB2F96]" />
                <span className="text-[12px] font-semibold text-[#353535]">成长时间线</span>
                <span className="text-[9px] text-[#9A9A9A] ml-auto">所有评估基于数据动态变化，非定性标签</span>
              </div>
              <div className="p-4">
                <div className="relative pl-5 border-l-2 border-[#F0F0F0] space-y-3">
                  {s.timeline.map((e, i) => {
                    const sty = TYPE_STYLE[e.type]
                    return (
                      <div key={i} className="relative">
                        <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center" style={{ background: sty.color }}>
                          <sty.icon size={8} className="text-white" />
                        </div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] text-[#9A9A9A]">{e.date}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: sty.bg, color: sty.color }}>{e.source}</span>
                        </div>
                        <p className="text-[12px] text-[#353535] leading-relaxed">{e.text}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'messages' && (
          /* ── 家长沟通 ── */
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F6F7F8] border-b border-[#E7E7EB] flex items-center gap-1.5">
              <MessageCircle size={13} className="text-[#353535]" />
              <span className="text-[12px] font-semibold text-[#353535]">与家长沟通记录</span>
            </div>
            <div className="p-4">
              {s.messages.length === 0 ? (
                <p className="text-[12px] text-[#9A9A9A] text-center py-6">暂无沟通记录</p>
              ) : (
                <div className="space-y-4">
                  {s.messages.map((m, i) => (
                    <div key={i} className={`flex gap-2.5 ${m.from === 'teacher' ? 'justify-end' : ''}`}>
                      {m.from === 'parent' && (
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-[10px] font-bold text-green-600 shrink-0 mt-0.5">家</div>
                      )}
                      <div className={`max-w-[70%] ${m.from === 'teacher' ? 'items-end' : ''}`}>
                        <div className={`px-3 py-2 rounded-[4px] ${m.from === 'teacher' ? 'bg-[#02A7F0]/10 text-[#353535]' : 'bg-[#F6F7F8] text-[#353535]'}`}>
                          <p className="text-[12px] leading-relaxed">{m.text}</p>
                        </div>
                        <div className={`text-[9px] text-[#9A9A9A] mt-0.5 ${m.from === 'teacher' ? 'text-right' : ''}`}>{m.time}</div>
                      </div>
                      {m.from === 'teacher' && (
                        <div className="w-7 h-7 rounded-full bg-[#02A7F0]/10 flex items-center justify-center text-[10px] font-bold text-[#02A7F0] shrink-0 mt-0.5">师</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 消息输入 */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#F0F0F0]">
                <input
                  type="text" value={msgText} onChange={e => setMsgText(e.target.value)}
                  placeholder="输入消息发送给家长…"
                  className="flex-1 px-3 py-2 text-[12px] border border-[#E7E7EB] rounded-[4px] outline-none focus:border-[#02A7F0] bg-[#F9FAFB]"
                />
                <button className="px-3 py-2 bg-[#02A7F0] text-white text-[11px] rounded-[4px] hover:bg-[#0288D1] flex items-center gap-1">
                  <Send size={12} />发送
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 教育善意度审查（底部常驻提示） ── */}
        <div className="bg-orange-50/50 border border-orange-100 rounded-[4px] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-[#595959]">
            <AlertCircle size={13} className="text-orange-400" />
            <span>所有评估描述基于当前数据，不作为学生定性判断。系统不存储任何标签字段。</span>
          </div>
          <button onClick={() => setShowKindnessReview(!showKindnessReview)} className="text-[10px] text-[#9A9A9A] hover:text-[#353535] flex items-center gap-0.5">
            教育善意度标准 {showKindnessReview ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
        {showKindnessReview && (
          <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-4 text-[11px] text-[#595959] space-y-1">
            <div className="font-semibold text-[#353535] mb-1">教育善意度审查要点：</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" />不包含比较性表述</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" />不包含绝对化判断</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" />已配合建设性建议</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-500" />评估基于具体行为/数据</div>
          </div>
        )}

        {/* ── 移出二次确认弹窗 ── */}
        {showRemoveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRemoveConfirm(false)}>
            <div className="bg-white rounded-[4px] shadow-2xl w-[400px] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-[#E7E7EB]">
                <h3 className="text-[14px] font-semibold text-[#353535]">确认移出关爱小组</h3>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="bg-[#FFF7E6] border border-orange-100 rounded-[4px] p-3">
                  <p className="text-[12px] text-[#595959] leading-relaxed">
                    即将将 <b className="text-[#353535]">{s.name}</b>（{s.studentNo}）移出关爱小组。
                  </p>
                  <p className="text-[11px] text-[#9A9A9A] mt-1.5">
                    该生于 {s.enrolledDate} 入组，已在组 <b className="text-[#353535]">{enrolledStr}</b>。
                  </p>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-[#E7E7EB] flex items-center gap-2 justify-end">
                <button onClick={() => setShowRemoveConfirm(false)} className="px-4 py-1.5 text-[12px] text-[#595959] border border-[#E7E7EB] rounded-[4px] hover:bg-[#F6F7F8]">取消</button>
                <button onClick={() => { setShowRemoveConfirm(false); /* 实际移出操作 */ }} className="px-4 py-1.5 text-[12px] text-white bg-red-500 rounded-[4px] hover:bg-red-600">确认移出</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 续期管理 */}
      {s.status === 'activated' && (
        <div className="bg-white border border-[#E7E7EB] rounded-[4px] p-4 mt-4">
          <div className="flex items-center justify-between">
            <div><div className="text-[13px] font-medium text-[#353535]">续期管理</div><div className="text-[11px] text-[#9A9A9A] mt-0.5">每学期末发起下学期入组确认</div></div>
            <div className="flex items-center gap-2">
              <button onClick={() => toast('已发起续期确认，家长将收到通知', 'success')} className="px-3 py-1.5 text-[12px] text-[#02A7F0] border border-[#02A7F0]/30 rounded-[4px] hover:bg-[#02A7F0]/5">发起续期</button>
              <button onClick={() => toast('该生将移出成长关爱', 'warning')} className="px-3 py-1.5 text-[12px] text-[#9A9A9A] border rounded-[4px] hover:bg-[#F6F7F8]">移出关爱</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
