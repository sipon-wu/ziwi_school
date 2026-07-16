// 真实模拟「出题(题库) + 组卷(试卷)」数据到 staging。
// 每学科建专属教师(已在 staging DB 建好 14 个：13900000001~14 / teacher123)，
// 每个教师按 学科×年级(1-9) 各灌 ≥3 出题 + ≥3 组卷。
// 运行：BASE=http://school1.ziwi.cn node qa/seed_subject_exercises_exams.cjs
const BASE = process.env.BASE || 'http://school1.ziwi.cn'
const SUBJECTS = ['语文','数学','英语','道德与法治','科学','物理','化学','生物','历史','地理','体育与健康','音乐','美术','信息科技']
const GRADES = ['一年级','二年级','三年级','四年级','五年级','六年级','七年级','八年级','九年级']
const DIFF = ['L1','L2','L3']

// 每学科题库(出题)与试卷题目池（真实-ish 内容，按学科适配）
const BANK = {
  '语文': {
    ex: [
      {t:'choice',stem:'下列加点字读音完全正确的一组是（ ）。',opt:'A. 澎湃(pài) B. 倔强(jiàng) C. 膝盖(qī) D. 纤维(qiān)',a:'B',an:'膝盖读xī，纤维读xiān；B 注音准确。',s:5},
      {t:'fill',stem:'“落霞与孤鹜齐飞，______。”出自王勃《滕王阁序》。',a:'秋水共长天一色',an:'名句默写，注意“长天”非“天长”。',s:5},
      {t:'short_answer',stem:'请简要概括《背影》中父亲的形象特点。',a:'慈爱、朴实、含蓄而深沉，对儿子悉心关怀。',an:'结合爬月台买橘子等细节作答。',s:10},
      {t:'essay',stem:'以“那一刻，我长大了”为题写一篇不少于400字的记叙文。',a:'（略，按记叙文要素评分）',an:'需有具体事件、心理变化、点题。',s:30},
    ],
    pool: [
      {t:'choice',stem:'下列句子没有语病的一项是（ ）。',opt:'A. 通过努力，使我进步 B. 他的成绩明显提高了 C. 能否成功是关键 D. 大约大概十点',a:'B',an:'A缺主语，C两面对一面，D重复。',s:5},
      {t:'reading',stem:'阅读文言短文，解释“欣然规往”中“规”的意思。',a:'打算、规划',an:'出自《桃花源记》，“规往”即打算前往。',s:6},
      {t:'fill',stem:'“先天下之忧而忧，______”出自范仲淹《岳阳楼记》。',a:'后天下之乐而乐',an:'名篇名句默写。',s:5},
    ],
  },
  '数学': {
    ex: [
      {t:'calculation',stem:'计算：36 × 25 ÷ 9 = ?',a:'100',an:'36÷9=4，4×25=100。',s:5},
      {t:'choice',stem:'一个等腰三角形的顶角是80°，底角是（ ）。',opt:'A. 50° B. 60° C. 80° D. 100°',a:'A',an:'(180-80)/2=50°。',s:5},
      {t:'fill',stem:'将分数 3/4 化成小数是（ ）。',a:'0.75',an:'3÷4=0.75。',s:5},
      {t:'application',stem:'小明买3支笔花12元，买7支笔需多少元？',a:'28元',an:'单价12÷3=4元，7×4=28元。',s:8},
    ],
    pool: [
      {t:'calculation',stem:'解方程：2x + 5 = 17',a:'x=6',an:'2x=12，x=6。',s:6},
      {t:'geometry',stem:'一个圆半径3cm，面积约为多少（π取3.14）？',a:'28.26 cm²',an:'S=πr²=3.14×9=28.26。',s:6},
      {t:'choice',stem:'下列各数中最小的是（ ）。',opt:'A. -2 B. 0 C. 1 D. 0.5',a:'A',an:'负数小于0和正数。',s:5},
    ],
  },
  '英语': {
    ex: [
      {t:'choice',stem:'— _____ do you go to school? — By bus.',opt:'A. What B. How C. When D. Where',a:'B',an:'问交通方式用How。',s:5},
      {t:'fill',stem:'Fill in: She _____ (go) to school every day.',a:'goes',an:'第三人称单数加-es。',s:5},
      {t:'translation',stem:'翻译：我最喜欢的科目是英语。',a:'My favorite subject is English.',an:'注意favorite拼写与subject单复数。',s:5},
      {t:'reading',stem:'Read: "Tom is a boy. He likes apples." True or False: Tom likes bananas.',a:'False',an:'原文说likes apples，未提bananas。',s:5},
    ],
    pool: [
      {t:'cloze',stem:'Cloze: ___ (be) there any milk in the glass?',opt:'A. Is B. Are C. Am D. Be',a:'A',an:'milk不可数，用Is。',s:5},
      {t:'writing',stem:'Write a short passage about your weekend (at least 5 sentences).',a:'(略)',an:'时态一致、要点齐全。',s:10},
      {t:'choice',stem:'— _____ you like apples? — Yes, I do.',opt:'A. Are B. Do C. Does D. Is',a:'B',an:'一般现在时疑问句用Do。',s:5},
    ],
  },
  '道德与法治': {
    ex: [
      {t:'choice',stem:'我国根本政治制度是（ ）。',opt:'A. 人民代表大会制度 B. 多党合作 C. 民族区域自治 D. 基层群众自治',a:'A',an:'人民代表大会制度是根本政治制度。',s:5},
      {t:'judge',stem:'公民享有权利，也应履行义务。（判断对错）',a:'正确',an:'权利与义务相统一。',s:5},
      {t:'short_answer',stem:'请列举两种依法行使权利的途径。',a:'协商、调解、仲裁、诉讼等（任写两种）。',an:'依据《宪法》公民权利救济途径。',s:8},
      {t:'case',stem:'同学被欺凌，你认为正确的做法是什么？',a:'及时报告老师家长，保留证据，必要时报警。',an:'依法维权，不私下报复。',s:8},
    ],
    pool: [
      {t:'choice',stem:'社会主义核心价值观国家层面的价值目标是（ ）。',opt:'A. 富强民主文明和谐 B. 自由平等公正法治 C. 爱国敬业诚信友善 D. 以上都不是',a:'A',an:'国家层面：富强、民主、文明、和谐。',s:5},
      {t:'analysis',stem:'结合材料，谈谈遵守规则的意义。',a:'(略)',an:'从秩序、权利保障、社会和谐角度。',s:10},
      {t:'short_answer',stem:'说一说在日常生活中如何做到诚信。',a:'守时、不撒谎、信守承诺等。',an:'诚信是公民基本道德。',s:8},
    ],
  },
  '科学': {
    ex: [
      {t:'choice',stem:'植物进行光合作用的主要场所是（ ）。',opt:'A. 线粒体 B. 叶绿体 C. 细胞核 D. 液泡',a:'B',an:'叶绿体含叶绿素，进行光合作用。',s:5},
      {t:'fill',stem:'水的化学式是（ ）。',a:'H₂O',an:'两个氢原子一个氧原子。',s:5},
      {t:'judge',stem:'声音不能在真空中传播。（判断）',a:'正确',an:'声音靠介质传播，真空无介质。',s:5},
      {t:'short_answer',stem:'举例说明一种可再生资源。',a:'太阳能、风能、水能等。',an:'可再生资源可循环利用。',s:8},
    ],
    pool: [
      {t:'choice',stem:'下列属于哺乳动物的是（ ）。',opt:'A. 鲸 B. 鲨鱼 C. 乌龟 D. 青蛙',a:'A',an:'鲸用肺呼吸、胎生，是哺乳动物。',s:5},
      {t:'observation',stem:'设计一个验证种子萌发需要水的实验。',a:'(略)',an:'控制变量：有水/无水对照。',s:10},
      {t:'fill',stem:'光沿（ ）传播。',a:'直线',an:'光在同种均匀介质中沿直线传播。',s:5},
    ],
  },
  '物理': {
    ex: [
      {t:'choice',stem:'速度的国际单位是（ ）。',opt:'A. km/h B. m/s C. N D. kg',a:'B',an:'SI单位m/s。',s:5},
      {t:'calculation',stem:'物体以5m/s匀速运动10s，路程为（ ）。',a:'50 m',an:'s=vt=5×10=50m。',s:5},
      {t:'fill',stem:'力的三要素是大小、方向和（ ）。',a:'作用点',an:'力有三要素。',s:5},
      {t:'short_answer',stem:'举例说明增大摩擦的方法。',a:'增大压力、使接触面粗糙。',an:'如刹车片压紧、轮胎花纹。',s:8},
    ],
    pool: [
      {t:'calculation',stem:'质量2kg物体受10N力，加速度（a=F/m）？',a:'5 m/s²',an:'a=10/2=5。',s:6},
      {t:'concept',stem:'简述牛顿第一定律。',a:'(略)',an:'惯性定律：不受外力时保持静止或匀速直线运动。',s:10},
      {t:'choice',stem:'下列工具利用杠杆的是（ ）。',opt:'A. 剪刀 B. 温度计 C. 天平(等臂) D. 弹簧测力计',a:'A',an:'剪刀是省力/费力杠杆。',s:5},
    ],
  },
  '化学': {
    ex: [
      {t:'choice',stem:'下列物质属于纯净物的是（ ）。',opt:'A. 空气 B. 蒸馏水 C. 海水 D. 泥土',a:'B',an:'蒸馏水只含水分子。',s:5},
      {t:'fill',stem:'氧气的化学式是（ ）。',a:'O₂',an:'氧分子双原子。',s:5},
      {t:'equation',stem:'写出氢气燃烧的化学方程式。',a:'2H₂ + O₂ 点燃 2H₂O',an:'配平：氢2氧1。',s:8},
      {t:'short_answer',stem:'如何用pH试纸测溶液酸碱度？',a:'用玻璃棒蘸取滴在试纸上，与比色卡对照。',an:'不能直接浸入。',s:8},
    ],
    pool: [
      {t:'choice',stem:'下列金属活动性最强的是（ ）。',opt:'A. 铜 B. 铁 C. 锌 D. 金',a:'C',an:'锌>铁>铜>金。',s:5},
      {t:'concept',stem:'说明质量守恒定律。',a:'(略)',an:'反应前后原子种类数目质量不变。',s:10},
      {t:'fill',stem:'地壳中含量最多的元素是（ ）。',a:'氧(O)',an:'氧约占地壳质量近一半。',s:5},
    ],
  },
  '生物': {
    ex: [
      {t:'choice',stem:'人体消化和吸收的主要器官是（ ）。',opt:'A. 胃 B. 小肠 C. 大肠 D. 食道',a:'B',an:'小肠绒毛增加吸收面积。',s:5},
      {t:'fill',stem:'细胞进行呼吸作用的主要场所是（ ）。',a:'线粒体',an:'线粒体是有氧呼吸场所。',s:5},
      {t:'judge',stem:'DNA是主要的遗传物质。（判断）',a:'正确',an:'绝大多数生物遗传物质是DNA。',s:5},
      {t:'short_answer',stem:'简述绿色植物在生态中的作用。',a:'生产者，制造有机物、释放氧气。',an:'维持碳氧平衡。',s:8},
    ],
    pool: [
      {t:'choice',stem:'血液中最多的血细胞是（ ）。',opt:'A. 红细胞 B. 白细胞 C. 血小板 D. 血浆',a:'A',an:'红细胞数量最多。',s:5},
      {t:'concept',stem:'描述细胞分裂的意义。',a:'(略)',an:'生长、发育、繁殖基础。',s:10},
      {t:'fill',stem:'人体最大的器官是（ ）。',a:'皮肤',an:'皮肤面积最大。',s:5},
    ],
  },
  '历史': {
    ex: [
      {t:'choice',stem:'中国历史上第一个王朝是（ ）。',opt:'A. 夏 B. 商 C. 周 D. 秦',a:'A',an:'禹建夏朝。',s:5},
      {t:'fill',stem:'丝绸之路开通于（ ）朝。',a:'汉',an:'张骞通西域，汉武帝时。',s:5},
      {t:'short_answer',stem:'简述商鞅变法的意义。',a:'使秦国富强，为统一奠基。',an:'废井田、奖军功等。',s:8},
      {t:'judge',stem:'科举制始于隋朝。（判断）',a:'正确',an:'隋炀帝设进士科。',s:5},
    ],
    pool: [
      {t:'choice',stem:'四大发明中用于航海的是（ ）。',opt:'A. 造纸术 B. 指南针 C. 火药 D. 印刷术',a:'B',an:'指南针用于航海导航。',s:5},
      {t:'analysis',stem:'分析鸦片战争的影响。',a:'(略)',an:'半殖民地半封建开端。',s:10},
      {t:'fill',stem:'甲骨文主要出土于（ ）(地名)。',a:'殷墟(安阳)',an:'商代后期都城遗址。',s:5},
    ],
  },
  '地理': {
    ex: [
      {t:'choice',stem:'地球上面积最大的大洋是（ ）。',opt:'A. 大西洋 B. 太平洋 C. 印度洋 D. 北冰洋',a:'B',an:'太平洋最大。',s:5},
      {t:'fill',stem:'赤道把地球分为南、北（ ）。',a:'半球',an:'赤道是南北半球分界线。',s:5},
      {t:'short_answer',stem:'简述季风气候的特点。',a:'夏高温多雨、冬寒冷干燥，雨热同期。',an:'受海陆热力差异影响。',s:8},
      {t:'judge',stem:'等高线越密，坡度越陡。（判断）',a:'正确',an:'密集表示坡度大。',s:5},
    ],
    pool: [
      {t:'choice',stem:'下列河流注入太平洋的是（ ）。',opt:'A. 尼罗河 B. 长江 C. 多瑙河 D. 密西西比河',a:'B',an:'长江注入东海（太平洋）。',s:5},
      {t:'analysis',stem:'分析某区域因地制宜发展农业的思路。',a:'(略)',an:'结合地形、气候、水源。',s:10},
      {t:'fill',stem:'比例尺越大，表示范围越（ ），内容越详。',a:'小',an:'大比例尺表示小范围。',s:5},
    ],
  },
  '体育与健康': {
    ex: [
      {t:'choice',stem:'标准篮球场比赛每队上场人数是（ ）。',opt:'A. 5 B. 6 C. 7 D. 11',a:'A',an:'篮球5人制。',s:5},
      {t:'fill',stem:'长跑后宜采用（ ）的方式放松，而非立即坐下。',a:'慢走',an:'逐步平复心率。',s:5},
      {t:'short_answer',stem:'列举两种发展心肺耐力的运动。',a:'慢跑、游泳、跳绳等。',an:'有氧运动。',s:8},
      {t:'judge',stem:'运动前充分热身可减少受伤。（判断）',a:'正确',an:'热身激活肌肉关节。',s:5},
    ],
    pool: [
      {t:'choice',stem:'下列属球类运动的是（ ）。',opt:'A. 游泳 B. 排球 C. 田径 D. 体操',a:'B',an:'排球是球类。',s:5},
      {t:'concept',stem:'说明科学锻炼的原则。',a:'(略)',an:'循序渐进、全面发展、持之以恒。',s:10},
      {t:'fill',stem:' volleyball 中文是（ ）。',a:'排球',an:'球类运动项目。',s:5},
    ],
  },
  '音乐': {
    ex: [
      {t:'choice',stem:'《欢乐颂》的作曲者是（ ）。',opt:'A. 贝多芬 B. 莫扎特 C. 巴赫 D. 肖邦',a:'A',an:'贝多芬第九交响曲。',s:5},
      {t:'fill',stem:'音乐中“4/4拍”表示以四分音符为一拍，每小节（ ）拍。',a:'4',an:'分子为每小节拍数。',s:5},
      {t:'short_answer',stem:'说出两种中国民族乐器。',a:'二胡、古筝、笛子、琵琶等。',an:'民族乐器分类。',s:8},
      {t:'judge',stem:'C大调音阶不含黑键。（判断）',a:'正确',an:'C大调白键自然音阶。',s:5},
    ],
    pool: [
      {t:'choice',stem:'下列属打击乐器的是（ ）。',opt:'A. 小提琴 B. 定音鼓 C. 长笛 D. 圆号',a:'B',an:'定音鼓是打击乐。',s:5},
      {t:'analysis',stem:'谈谈你对“音乐表现情绪”的理解。',a:'(略)',an:'速度、力度、调式塑造情绪。',s:10},
      {t:'fill',stem:'do re mi fa sol la si 对应唱名，其简谱记为（ ）。',a:'1 2 3 4 5 6 7',an:'首调唱名法。',s:5},
    ],
  },
  '美术': {
    ex: [
      {t:'choice',stem:'三原色是指（ ）。',opt:'A. 红黄蓝 B. 红绿蓝 C. 橙紫绿 D. 黑白灰',a:'A',an:'颜料三原色红黄蓝。',s:5},
      {t:'fill',stem:'中国画按题材可分为山水、花鸟和（ ）。',a:'人物',an:'三大科：山水花鸟人物。',s:5},
      {t:'short_answer',stem:'说出两种绘画构图方法。',a:'三角形构图、S形构图、对称构图等。',an:'构图基本原则。',s:8},
      {t:'judge',stem:'透视中“近大远小”符合焦点透视规律。（判断）',a:'正确',an:'焦点透视特征。',s:5},
    ],
    pool: [
      {t:'choice',stem:'下列属冷色调的是（ ）。',opt:'A. 红 B. 橙 C. 蓝 D. 黄',a:'C',an:'蓝紫属冷色。',s:5},
      {t:'analysis',stem:'描述一幅你喜欢的画作及理由。',a:'(略)',an:'从造型、色彩、意境评价。',s:10},
      {t:'fill',stem:'素描中表现明暗过渡的术语是（ ）。',a:'明暗调子',an:'五大调子。',s:5},
    ],
  },
  '信息科技': {
    ex: [
      {t:'choice',stem:'计算机中数据的基本存储单位是（ ）。',opt:'A. 字节 B. 位 C. 字 D. 兆',a:'B',an:'bit是最小单位，字节=8bit常用。',s:5},
      {t:'fill',stem:'十进制数 10 转为二进制是（ ）。',a:'1010',an:'8+2=10 → 1010。',s:5},
      {t:'short_answer',stem:'什么是算法？举一个生活例子。',a:'解决问题的步骤；如菜谱步骤。',an:'有序、确定、可行。',s:8},
      {t:'judge',stem:'病毒可通过U盘传播。（判断）',a:'正确',an:'移动介质可传毒。',s:5},
    ],
    pool: [
      {t:'choice',stem:'下列属输入设备的是（ ）。',opt:'A. 打印机 B. 显示器 C. 键盘 D. 音箱',a:'C',an:'键盘输入设备。',s:5},
      {t:'concept',stem:'简述计算机网络的作用。',a:'(略)',an:'资源共享、通信、分布式处理。',s:10},
      {t:'fill',stem:'HTTP 是（ ）层协议（应用/传输/网络）。',a:'应用',an:'HTTP属应用层。',s:5},
    ],
  },
}

// 试卷题目类型归一化到 ExamQuestion 联合类型
const EXAM_TYPE = { choice:'choice', fill:'fill', calculation:'calculation', reading:'reading', writing:'writing', essay:'writing', translation:'short_answer', short_answer:'short_answer', judge:'truefalse', case:'short_answer', analysis:'short_answer', concept:'short_answer', observation:'short_answer', equation:'calculation', geometry:'calculation', application:'short_answer', cloze:'cloze' }

function toExamQuestion(item, i) {
  return {
    id: 'q' + (i + 1),
    stem: item.stem,
    type: EXAM_TYPE[item.t] || 'short_answer',
    options: item.opt || '',
    answer: item.a,
    analysis: item.an || '',
    score: item.s || 5,
  }
}

async function login(phone) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password: 'teacher123' }),
  })
  if (!r.ok) throw new Error('login ' + phone + ' -> ' + r.status)
  const j = await r.json()
  return j.token
}

async function postJson(path, token, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(path + ' -> ' + r.status + ' ' + txt.slice(0, 120))
  }
  return r.status
}

function pick(arr, start, n) {
  const out = []
  for (let k = 0; k < n; k++) out.push(arr[(start + k) % arr.length])
  return out
}

async function run() {
  let ok = 0, fail = 0
  const failures = []
  const summary = {}
  const CONC = 8
  let active = 0
  const queue = []

  for (let si = 0; si < SUBJECTS.length; si++) {
    const subject = SUBJECTS[si]
    const phone = '139000000' + String(si + 1).padStart(2, '0')
    const bank = BANK[subject]
    let token
    try { token = await login(phone) }
    catch (e) { failures.push(`[login] ${subject} ${phone}: ${e.message}`); continue }

    for (let gi = 0; gi < GRADES.length; gi++) {
      const grade = GRADES[gi]
      const diff = DIFF[gi % DIFF.length]

      // 3 出题（题库）
      const exItems = pick(bank.ex, gi, 3)
      exItems.forEach((it, idx) => {
        queue.push(async () => {
          try {
            await postJson('/api/exercises', token, {
              stem: it.stem, answer: it.a, analysis: it.an, question_type: it.t,
              subject, grade, difficulty: diff, score: it.s, source: 'seed',
            })
            ok++; summary[subject] = (summary[subject] || 0) + 1
          } catch (e) { fail++; failures.push(`[ex] ${subject}/${grade}#${idx}: ${e.message}`) }
        })
      })

      // 3 组卷（试卷）
      for (let ei = 0; ei < 3; ei++) {
        const qs = pick(bank.pool.concat(bank.ex), gi + ei, 4 + (ei % 2)).map(toExamQuestion)
        const total = qs.reduce((s, q) => s + (q.score || 5), 0)
        queue.push(async () => {
          try {
            await postJson('/api/exams', token, {
              title: `${grade}${subject}第${ei + 1}单元测试卷`,
              subject, grade,
              questions: JSON.stringify(qs),
              total_score: total, duration_minutes: 60, difficulty: diff,
              edit_mode: 'ai', paper_size: 'A3',
            })
            ok++; summary[subject] = (summary[subject] || 0) + 1
          } catch (e) { fail++; failures.push(`[exam] ${subject}/${grade}#${ei}: ${e.message}`) }
        })
      }
    }
  }

  // 并发执行
  async function worker() {
    while (queue.length) {
      const task = queue.shift()
      if (!task) break
      await task()
    }
  }
  const workers = []
  for (let i = 0; i < CONC; i++) workers.push(worker())
  await Promise.all(workers)

  console.log('\n=== 模拟数据完成 ===')
  console.log('成功', ok, '失败', fail)
  console.log('分学科记录数:')
  for (const s of SUBJECTS) console.log('  ' + s + ': ' + (summary[s] || 0))
  if (failures.length) {
    console.log('\n前20条失败:')
    failures.slice(0, 20).forEach(f => console.log('  ' + f))
  }
}

run().catch(e => { console.error('FATAL', e); process.exit(1) })
