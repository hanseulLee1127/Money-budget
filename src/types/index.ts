// 거래 내역 타입 정의
export interface Transaction {
  id: string;
  date: string; // ISO 날짜 형식
  description: string;
  amount: number;
  category: string;
  isConfirmed: boolean;
  createdAt: Date;
  updatedAt?: Date;
  // Recurring 관련
  isRecurring?: boolean;
  recurringFrequency?: 'monthly' | 'bi-weekly' | 'weekly';
  recurringDay?: number; // 반복할 날짜 (1-31) 또는 요일 (0-6)
}

// PDF에서 파싱된 거래 내역 (아직 카테고리 분류 전)
export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  rawText: string;
}

// AI가 분류한 거래 내역
export interface CategorizedTransaction extends ParsedTransaction {
  category: string;
  confidence?: number; // AI 신뢰도 (선택적)
}

// 카테고리 타입 정의
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
}

// 사용자 프로필 타입
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: Date;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 대시보드 요약 데이터
export interface DashboardSummary {
  totalSpending: number;
  monthlySpending: number;
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  recentTransactions: Transaction[];
}

// AI Insight
export interface Insight {
  id: string;
  analysis: string;
  period: string;
  createdAt: Date;
}

// 구독 플랜: trial(1회 무료) | basic($5/3회) | pro($10/10회)
export type SubscriptionPlan = 'trial' | 'basic' | 'pro' | null;

export interface SubscriptionState {
  plan: SubscriptionPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  periodStart?: Date;
  uploadsUsedThisMonth: number;
  trialUsed: boolean;
}
