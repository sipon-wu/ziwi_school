// 用户/角色类型定义（前后端共享）

export interface UserInfo {
  id: string;
  schoolId: string;
  phone: string;
  role: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  wechatOpenid?: string;
  status: 'active' | 'disabled' | 'left';
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export interface TeachingContext {
  schoolId: string;
  schoolName: string;
  classId: string;
  className: string;
  subject: string;
  grade: string;
  textbookVersionId: string;
  textbookVersionName: string;
}
