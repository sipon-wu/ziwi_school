// API 通用类型定义（前后端共享）

export interface PaginationParams {
  page: number;
  page_size: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface APIResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface APIError {
  code: number;
  message: string;
  details?: Record<string, string[]>;
}
