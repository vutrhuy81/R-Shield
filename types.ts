export interface TrendDataPoint {
  date: string;
  [key: string]: string | number;
}

// [UPDATED] Interface cho từng mục trong Checklist
export interface ChecklistItem {
  sign: string;
  detected: boolean;
  reason: string;
}

// [UPDATED] Interface phản hồi từ API Gemini, bao gồm checklist
export interface TrendAnalysisResponse {
  data: TrendDataPoint[];
  summary: string;
  groundingMetadata?: any;
  checklist?: ChecklistItem[]; // Trường chứa dữ liệu checklist
}

export interface SearchTerm {
  id: string;
  term: string;
  color: string;
}

export type DataSource = 'GEMINI' | 'GOOGLE_TRENDS';

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export type SearchType = 'web' | 'images' | 'news' | 'froogle' | 'youtube';

export interface LocationOption {
  code: string;
  name: string;
}

export type UserRole = 'ADMIN' | 'GUEST';

export interface User {
  username: string;
  role: UserRole;
}

export type Language = 'vi' | 'en';
