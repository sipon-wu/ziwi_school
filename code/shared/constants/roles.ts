// ═══════════════════════════════════════════
// 8 角色定义（前后端共享常量）
// ═══════════════════════════════════════════

export const ROLES = {
  TEACHER: 'teacher',
  HEAD_TEACHER: 'head_teacher',
  RESEARCH_LEAD: 'research_lead',
  REGISTRAR: 'registrar',
  PRINCIPAL: 'principal',
  IT_ADMIN: 'it_admin',
  PLATFORM_OPS: 'platform_ops',
  PLATFORM_DEVOPS: 'platform_devops',
  STUDENT: 'student',
  PARENT: 'parent',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  teacher: '教师',
  head_teacher: '班主任',
  research_lead: '教研组长',
  registrar: '教务员',
  principal: '校长',
  it_admin: 'IT管理员',
  platform_ops: '平台运营',
  platform_devops: '平台运维',
  student: '学生',
  parent: '家长',
};

// 校内角色（有 school_id 绑定）
export const SCHOOL_ROLES: Role[] = [
  'teacher',
  'head_teacher',
  'research_lead',
  'registrar',
  'principal',
  'it_admin',
  'student',
  'parent',
];

// 平台角色（跨学校）
export const PLATFORM_ROLES: Role[] = ['platform_ops', 'platform_devops'];

// 可登录PC端的角色
export const PC_ROLES: Role[] = [
  'teacher',
  'head_teacher',
  'research_lead',
  'registrar',
  'principal',
  'it_admin',
  'platform_ops',
  'platform_devops',
];
