// CareDetail 降级 mock 数据（后端不可用时加载）
// 类型 StudentDetail
type StudentDetail = {
  id: string; name: string; studentNo: string; gender: string; grade: number
  enrolledDate: string; status: 'activated' | 'pending'
  accuracy: number; accuracyTrend: 'up' | 'down' | 'flat'; accuracyChange: number
  accuracyHistory: { week: string; value: number }[]
  assessments: { date: string; type: 'ai' | 'teacher' | 'mixed'; text: string }[]
  plan: {
    focusArea: string; generatedAt: string; nextGeneration: string
    status: 'draft' | 'confirmed' | 'executing'
    exercises: { title: string; type: string; tier: string; count: number; frequency: string; estimatedTime: string; reason: string; progress: number }[]
    tasks: { text: string; done: boolean }[]
    teacherNote: string
  } | null
  timeline: { date: string; type: string; source: string; text: string }[]
  messages: { from: 'teacher' | 'parent'; time: string; text: string }[]
}

const MOCK_STUDENT_DATA: Record<string, StudentDetail> = {
  s1: {
    id: 's1', name: '赵大鹏', studentNo: '20240007', gender: '男', grade: 4,
    enrolledDate: '2026-03-01', status: 'activated',
    accuracy: 68, accuracyTrend: 'up', accuracyChange: 6,
    accuracyHistory: [{ week: '3月', value: 58 }, { week: '4月', value: 60 }, { week: '5月', value: 63 }, { week: '6月', value: 65 }, { week: '7月', value: 68 }],
    assessments: [
      { date: '2026-07-05', type: 'mixed', text: '【小微评估】该生在分数比较题型上的正确率为52%，低于其自身前两周的68%。近期作业中，异分母分数比较的错误率较高，主要表现为通分步骤遗漏。计算基础题正确率稳定在75%以上，表明基础运算能力尚可，差距主要集中在应用题的理解转化环节。\n\n【教师观察】近期课堂专注度有所下降，后排座位时容易被同桌分散注意。上周面谈时该生表示"分数题目太绕了，读不懂。"本周调至前排后课堂互动频率明显提升。建议方案中增加"先读题再解题"的步骤引导，降低因阅读理解导致的失分。' },
      { date: '2026-06-28', type: 'mixed', text: '【小微评估】该生分数比较正确率从58%升至65%，呈上升趋势。通分步骤遗漏仍是主要问题，占错题原因的40%。应用题方面，题意理解正确率从45%升至55%，进步明显但仍有空间。\n\n【教师观察】该生本周课堂举手3次（上周为0次），课后主动问了一道分数比较题。虽然正确率仍偏低，但学习态度有明显转变。建议继续鼓励，不急于增加难度。' },
      { date: '2026-06-15', type: 'teacher', text: '与该生进行了10分钟课后谈话。了解到他对于"分数"这个概念本身有畏难情绪，主要原因是三年级时一次课堂提问答错后被同学笑了。这个心理因素比知识漏洞更需要关注。已安排每周一次"小老师"角色，让他给同桌讲解简单的分数题，逐步重建自信。' },
      { date: '2026-06-07', type: 'ai', text: '该生当前综合正确率60%，在班级中处于偏下水平。各题型中，分数比较类正确率最低（52%），远低于班级平均的78%。字词默写正确率85%，基础尚可。建议从同分母分数比较开始，难度逐级提升。' },
    ],
    plan: {
      focusArea: '异分母分数比较是当前薄弱环节，通分步骤需强化。同时需通过读题训练降低因题意理解导致的失分。',
      generatedAt: '2026-07-06（周一）06:00', nextGeneration: '2026-07-13（周一）06:00', status: 'executing',
      exercises: [
        { title: '异分母通分专项计算', type: '计算练习', tier: '中等', count: 14, frequency: '每周4次', estimatedTime: '每次10分钟', reason: '最新评估显示通分步骤遗漏占错题40%', progress: 85 },
        { title: '分数比较应用题（读题三步法）', type: '口算打卡', tier: '基础', count: 5, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '教师观察建议增加读题步骤引导', progress: 60 },
      ],
      tasks: [{ text: '整理本周分数错题，分析错误原因，写在错题本上', done: true }, { text: '课后找老师复述一遍"读题三步法"', done: false }],
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
    ],
  },
  s2: {
    id: 's2', name: '孙小飞', studentNo: '20240008', gender: '男', grade: 4,
    enrolledDate: '2026-03-15', status: 'activated',
    accuracy: 55, accuracyTrend: 'up', accuracyChange: 3,
    accuracyHistory: [{ week: '3月', value: 48 }, { week: '4月', value: 50 }, { week: '5月', value: 52 }, { week: '6月', value: 53 }, { week: '7月', value: 55 }],
    assessments: [
      { date: '2026-07-05', type: 'mixed', text: '【小微评估】该生目前在排比句运用上的正确率为45%，低于班级平均水平。近期仿写类题目中，句式结构不完整的情况占错题的60%以上。基础知识（字词默写）正确率稳定在80%，说明基础字词掌握较好，问题主要集中在表达类题型。\n\n【教师观察】该生性格内向，课堂上很少主动发言。上次作文课让他到黑板前写一个排比句，写出来的句子虽然简单但结构正确，说明他不是不会，是缺乏信心。建议在方案中增加"每日一句"的小任务，降低难度门槛，先建立自信心。' },
      { date: '2026-06-20', type: 'teacher', text: '课堂上第一次主动举手回答问题（虽然声音很小）。作文中出现了两个自己写的排比句，虽然有结构瑕疵但比之前完全仿写好很多。开始有独立创作的意识了。' },
      { date: '2026-06-07', type: 'ai', text: '该生排比句运用正确率仅为42%，句式结构不完整是主要问题。字词基础尚可，但表达类题型整体偏弱。' },
    ],
    plan: {
      focusArea: '排比句运用是当前最大薄弱项，句式结构不完整占错题60%以上。需从仿写过渡到独立创作，同时积累优质句式。',
      generatedAt: '2026-07-06（周一）06:00', nextGeneration: '2026-07-13（周一）06:00', status: 'executing',
      exercises: [
        { title: '排比句仿写（每日一句）', type: '口算打卡', tier: '基础', count: 20, frequency: '每周5次', estimatedTime: '每次10分钟', reason: '教师观察建议降低难度门槛，先建立信心', progress: 70 },
        { title: '课文精彩句式摘抄与分析', type: '专项训练', tier: '中等', count: 5, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '积累规范句式，为独立创作打基础', progress: 50 },
      ],
      tasks: [{ text: '本周至少摘抄3篇课文中的排比句，标注句式特点', done: false }, { text: '用排比句写一段"我的周末"，不少于4句', done: true }],
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
    accuracyHistory: [{ week: '4月', value: 60 }, { week: '5月', value: 61 }, { week: '6月', value: 63 }, { week: '7月', value: 62 }],
    assessments: [
      { date: '2026-07-05', type: 'mixed', text: '【小微评估】该生近三周成绩波动在±2%范围内，处于平台期。仿写表达类题目正确率维持在中位水平，无明显进步。但作业完成率从4月的78%降至6月的65%，说明练习量的减少可能是成绩停滞的重要原因。\n\n【教师观察】最近几周发现该生作业经常迟交或漏交。与家长沟通后了解到，这学期参加了校外足球训练，每周三次，回家后精力不足。已与家长协商将足球训练减少到每周两次，本周开始初见成效。' },
      { date: '2026-05-15', type: 'ai', text: '仿写表达正确率60%，按中等水平。作业完成率从78%开始下降，需关注。' },
    ],
    plan: {
      focusArea: '成绩处于平台期，当前首要目标是恢复练习量。已与家长协商减少课外训练，需持续观察作业完成率变化。',
      generatedAt: '2026-07-06（周一）06:00', nextGeneration: '2026-07-13（周一）06:00', status: 'executing',
      exercises: [{ title: '仿写表达基础句式练习', type: '计算练习', tier: '基础', count: 5, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '评估显示练习量下降是停滞主因，先恢复节奏', progress: 40 }],
      tasks: [{ text: '本周至少3天放学后先完成作业再去玩', done: false }, { text: '在错题本上整理本周仿写错误', done: true }],
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
  s4: { id: 's4', name: '冯小美', studentNo: '20240012', gender: '女', grade: 4, enrolledDate: '2026-04-20', status: 'pending', accuracy: 58, accuracyTrend: 'down', accuracyChange: 4, accuracyHistory: [{ week: '4月', value: 62 }, { week: '5月', value: 60 }, { week: '6月', value: 59 }, { week: '7月', value: 58 }], assessments: [{ date: '2026-04-20', type: 'ai', text: '该生当前正确率62%，在班级中处于中等偏下水平。多角度提问类题目正确率偏低，建议重点关注。' }], plan: { focusArea: '多角度提问能力需加强，当前正确率呈下降趋势，需及时干预。', generatedAt: '2026-04-20（入组即生成）', nextGeneration: '2026-07-13（周一）06:00', status: 'executing', exercises: [{ title: '多角度提问专项训练', type: '专项训练', tier: '基础', count: 10, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '多角度提问正确率偏低且呈下降趋势', progress: 55 }], tasks: [{ text: '每次练习后自评：是否用了至少2种角度提问', done: false }], teacherNote: '' }, timeline: [{ date: '2026-04-20', type: 'system', source: '系统', text: '教师从成长足迹勾选该生纳入成长关爱，方案已自动生成' }], messages: [] },
  s5: { id: 's5', name: '苗小光', studentNo: '20240045', gender: '男', grade: 4, enrolledDate: '2026-05-05', status: 'activated', accuracy: 71, accuracyTrend: 'up', accuracyChange: 8, accuracyHistory: [{ week: '5月', value: 63 }, { week: '6月', value: 67 }, { week: '7月', value: 71 }], assessments: [{ date: '2026-07-04', type: 'ai', text: '该生分数混合运算进步显著，近一个月正确率提升8%。运算顺序错误从高频降至偶发，已基本掌握先乘除后加减的规则。建议在维持当前节奏的基础上，逐步引入带括号的复杂运算。' }], plan: { focusArea: '分数混合运算进步显著，建议维持当前节奏，逐步引入带括号的复杂运算。', generatedAt: '2026-07-06（周一）06:00', nextGeneration: '2026-07-13（周一）06:00', status: 'executing', exercises: [{ title: '分数混合运算巩固（含通分）', type: '计算练习', tier: '中等', count: 12, frequency: '每周4次', estimatedTime: '每次10分钟', reason: '运算顺序已基本掌握，巩固为主', progress: 90 }, { title: '带括号的复杂运算入门', type: '专项训练', tier: '挑战', count: 8, frequency: '每周3次', estimatedTime: '每次15分钟', reason: '逐步引入新难度', progress: 75 }], tasks: [{ text: '完成本周混合运算错题整理', done: true }], teacherNote: '小光最近状态很好，请继续保持！下周会加一点括号运算的内容，难度不大。' }, timeline: [{ date: '2026-07-04', type: 'plan', source: '小微', text: '方案更新：混合运算巩固 + 括号优先级' }, { date: '2026-05-05', type: 'system', source: '系统', text: '纳入成长关爱' }], messages: [{ from: 'teacher', time: '2026-07-01', text: '苗小光进步很大，继续保持！' }, { from: 'parent', time: '2026-07-01', text: '感谢老师！我们在家也发现他做题更自信了。' }] },
  s6: { id: 's6', name: '花小玉', studentNo: '20240046', gender: '女', grade: 4, enrolledDate: '2026-06-01', status: 'pending', accuracy: 65, accuracyTrend: 'up', accuracyChange: 2, accuracyHistory: [{ week: '6月', value: 63 }, { week: '7月', value: 65 }], assessments: [{ date: '2026-06-01', type: 'ai', text: '该生当前正确率63%，词语理解类题目正确率低于班级平均。近期呈小幅上升趋势，建议持续观察。' }], plan: { focusArea: '词语理解能力有改善迹象，建议以巩固为主，辅以适当拓展。', generatedAt: '2026-06-01（入组即生成）', nextGeneration: '2026-07-13（周一）06:00', status: 'executing', exercises: [{ title: '词语理解与运用练习', type: '口算打卡', tier: '基础', count: 8, frequency: '每周3次', estimatedTime: '每次10分钟', reason: '正确率偏低但呈上升趋势，巩固为主', progress: 65 }], tasks: [{ text: '每天阅读一篇短文并标注生词', done: true }], teacherNote: '' }, timeline: [{ date: '2026-06-01', type: 'system', source: '系统', text: '纳入成长关爱，方案已自动生成' }], messages: [] },
  s7: { id: 's7', name: '褚小刚', studentNo: '20240013', gender: '男', grade: 4, enrolledDate: '2026-02-15', status: 'removed' as any, accuracy: 76, accuracyTrend: 'up', accuracyChange: 4, accuracyHistory: [{ week: '2月', value: 61 }, { week: '3月', value: 65 }, { week: '4月', value: 70 }, { week: '5月', value: 73 }, { week: '6月', value: 76 }], assessments: [{ date: '2026-06-15', type: 'mixed', text: '【小微评估】该生正确率已稳定在75%以上，连续6周呈上升趋势，已从最初的61%提升至76%。分数比较、混合运算等核心题型正确率均超过班级平均。\n\n【教师观察】该生本学期进步显著，已具备自主学习能力。与家长沟通后一致认为可以结业移出关爱小组。' }, { date: '2026-02-15', type: 'ai', text: '该生初始正确率61%，分数比较和混合运算两类题型偏弱，纳入成长关爱。' }], plan: { focusArea: '该生已达标移出。', generatedAt: '2026-02-15（入组即生成）', nextGeneration: '已停止（2026-06-20移出）', status: 'executing', exercises: [], tasks: [], teacherNote: '' }, timeline: [{ date: '2026-06-20', type: 'system', source: '系统', text: '教师将该生移出关爱小组，方案生成停止。历史记录保留。' }, { date: '2026-06-15', type: 'plan', source: '小微', text: '综合评估：正确率达标，建议结业' }, { date: '2026-02-15', type: 'system', source: '系统', text: '纳入成长关爱' }], messages: [{ from: 'teacher', time: '2026-06-20', text: '褚小刚家长您好，孩子本学期进步很大，正确率从61%提升到76%，已达到预期目标。即日起移出关爱小组，后续如有需要可重新纳入。孩子这段时间的所有成长记录都会保留。' }, { from: 'parent', time: '2026-06-20', text: '感谢张老师这4个月的悉心指导！孩子的变化我们看在眼里，真的很感激。' }] },
}

export default MOCK_STUDENT_DATA
