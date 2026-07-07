// 题目类型定义（前后端共享）

export interface Question {
  id: string;
  teacherId: string;
  schoolId: string;
  subject: string;
  grade: string;
  stem: string;
  answer: string;
  analysis?: string;
  questionType: QuestionType;
  score: number;
  knowledgeNodes?: string[];
  difficulty: DifficultyLevel;
  discrimination?: number;
  source: 'textbook' | 'exam' | 'original';
  useCount: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type QuestionType = 'choice' | 'fill' | 'judge' | 'short_answer' | 'essay';

export type DifficultyLevel = 'L1' | 'L2' | 'L3' | 'L4';

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  L1: '基础',
  L2: '中等',
  L3: '较难',
  L4: '拓展',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice: '选择题',
  fill: '填空题',
  judge: '判断题',
  short_answer: '简答题',
  essay: '作文/论述题',
};
