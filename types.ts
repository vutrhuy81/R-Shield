
export interface TrendDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface TrendAnalysisResponse {
  data: TrendDataPoint[];
  summary: string;
  groundingMetadata?: any;
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
