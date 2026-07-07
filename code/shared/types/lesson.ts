// 教案类型定义（前后端共享）

export interface LessonPlan {
  id: string;
  teacherId: string;
  schoolId: string;
  classId?: string;
  subject: string;
  grade: string;
  textbookVersionId?: string;
  title: string;
  unit?: string;
  lessonPeriod: number;
  templateType: string;
  content: LessonContent;
  knowledgeNodes?: string[];
  customTags?: string[];
  curriculumAlignments?: CurriculumAlignment[];
  supplementText?: string;
  materialRefs?: string[];
  aiGenerated: boolean;
  reviewStatus: 'none' | 'pending' | 'approved' | 'returned';
  status: 'draft' | 'published' | 'archived';
  editCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonContent {
  objectives?: string[];
  keyPoints?: string[];
  difficultPoints?: string[];
  process?: LessonProcessBlock[];
  blackboardDesign?: string;
  homework?: string;
  reflection?: string;
}

export interface LessonProcessBlock {
  type: 'lead_in' | 'presentation' | 'practice' | 'summary' | 'extension';
  title: string;
  duration: number; // 分钟
  content: string;
  materials?: string[];
}

export interface CurriculumAlignment {
  standardId: string;
  standardCode: string;
  matchScore: number;
}
