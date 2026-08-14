/**
 * courseware-h5 绘本式互动课件 —— 数据模型
 *
 * 设计目标（呼应小微创作中枢需求）：
 * 把"AI 课件 markdown"解析为结构化的「绘本场景 Story」，
 * 由 renderer 渲染成童趣绘本风自包含 HTML，由 pager 提供翻页引擎，
 * 由 interactive 提供点读/跟读/quiz/draw 等互动能力。
 *
 * 与旧幻灯片式（H5Slide）的区别：
 * 旧 = 把教案 markdown 逐页切文本；新 = 情景分镜（角色气泡 + 分镜卡片 + 互动）。
 */

/** 绘本角色（情景对话中的人物/卡通形象） */
export interface StoryRole {
  name: string
  /** 头像 emoji 或首字母（无图源时用纯文本/emoji 渲染，避免外部依赖） */
  avatar?: string
  /** 角色气泡配色（可选，缺省按角色序号自动分配） */
  color?: string
}

/** 互动类型 */
export type StoryInteractionType =
  | 'read'      // 点读：点击单词/句子高亮 + TTS 朗读
  | 'readalong' // 跟读：录音 + 回放 + 评分暗示
  | 'quiz'      // 随堂选择
  | 'reveal'    // 点击揭示
  | 'draw'      // 绘图白板
  | 'popup'     // 弹层
  | 'audio'     // 音频
  | 'video'     // 视频
  | 'gallery'   // 图册

/** 点读单元（一句话/一个词，可点击朗读） */
export interface ReadUnit {
  text: string
  /** 可选注音/翻译（点读后展示） */
  hint?: string
  /** 可选音频（接入后端后传 src；缺省用浏览器 TTS） */
  src?: string
}

/** 跟读单元（句子 + 录音回放） */
export interface ReadAlongUnit {
  text: string
  /** 可选示范音频 */
  src?: string
}

/** 选择题 */
export interface QuizUnit {
  question: string
  options: string[]
  correct: number
}

export interface StoryInteraction {
  type: StoryInteractionType
  /** read：点读单元列表 */
  reads?: ReadUnit[]
  /** readalong：跟读单元列表 */
  sentences?: ReadAlongUnit[]
  /** quiz */
  quiz?: QuizUnit
  /** reveal */
  prompt?: string
  answer?: string
  /** draw */
  drawTitle?: string
  drawHint?: string
  /** popup */
  triggerText?: string
  popupContent?: string
  /** audio/video/gallery */
  src?: string
  poster?: string
  images?: string[]
  title?: string
}

/** 一个绘本场景（=一页） */
export interface StoryScene {
  /** 场景标题（分镜标题，如"热身：去超市购物"） */
  title?: string
  /** 旁白/背景说明文字 */
  narration?: string
  /** 角色对话气泡（按顺序渲染） */
  bubbles?: { role?: string; text: string }[]
  /** 教学重点提示（底部高亮条） */
  focus?: string
  /** 本场景互动 */
  interaction?: StoryInteraction
  /** 背景风格（影响配色/装饰，可空） */
  mood?: 'warm' | 'playful' | 'calm' | 'energetic'
}

/** 整个绘本课件 */
export interface Story {
  title: string
  subject: string
  grade: string
  teacherName?: string
  /** 角色表（用于气泡着色与头像） */
  roles?: StoryRole[]
  scenes: StoryScene[]
  /** 皮肤 */
  themeId?: string
  /** 自动播放 */
  autoPlay?: boolean
  autoPlayInterval?: number
}

/** 绘本皮肤（配色，不含布局） */
export const STORY_THEMES: Record<string, {
  bg1: string; bg2: string; card: string; accent: string; accent2: string; text: string; ink: string
}> = {
  // 童趣绘本（小学低段英语情景通用）
  storybook: { bg1: '#FFE8C9', bg2: '#FFD6E0', card: '#FFFDF8', accent: '#FF8A5B', accent2: '#5B8DEF', text: '#3A2E2E', ink: '#5A4A4A' },
  // 森林晨光
  forest:   { bg1: '#DFF5E1', bg2: '#CDEBFF', card: '#FCFEF8', accent: '#3FA34D', accent2: '#2B8ACB', text: '#2C3A2E', ink: '#4A5A4A' },
  // 星空夜读
  night:    { bg1: '#2A2350', bg2: '#3D2B6B', card: '#FFFDF8', accent: '#FFB454', accent2: '#7C6FF0', text: '#2A2350', ink: '#3A2E5A' },
  // 海洋 (适配旧 ocean 默认)
  ocean:    { bg1: '#0f1226', bg2: '#16203f', card: '#FFFDF8', accent: '#1A3A6B', accent2: '#2B5DA8', text: '#222', ink: '#333' },
}

/** 角色配色环（无 color 时按序号分配） */
export const ROLE_COLORS = ['#FF8A5B', '#5B8DEF', '#3FA34D', '#C065D6', '#F2B705', '#22B8A6']
