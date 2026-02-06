import { Category } from '@/types';

// 기본 카테고리 목록 (영어)
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: 'Food and Grocery',
    color: '#ef4444', // red-500
    icon: '🛒',
    isDefault: true,
  },
  {
    id: 'transportation',
    name: 'Transportation',
    color: '#3b82f6', // blue-500
    icon: '🚗',
    isDefault: true,
  },
  {
    id: 'shopping',
    name: 'Shopping',
    color: '#8b5cf6', // violet-500
    icon: '🛍️',
    isDefault: true,
  },
  {
    id: 'housing',
    name: 'Housing',
    color: '#22c55e', // green-500
    icon: '🏠',
    isDefault: true,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    color: '#f59e0b', // amber-500
    icon: '💡',
    isDefault: true,
  },
  {
    id: 'medical',
    name: 'Medical',
    color: '#ec4899', // pink-500
    icon: '🏥',
    isDefault: true,
  },
  {
    id: 'insurance',
    name: 'Insurance',
    color: '#0d9488', // teal-600
    icon: '🛡️',
    isDefault: true,
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    color: '#06b6d4', // cyan-500
    icon: '🎬',
    isDefault: true,
  },
  {
    id: 'subscription',
    name: 'Subscription',
    color: '#6366f1', // indigo-500
    icon: '📱',
    isDefault: true,
  },
  {
    id: 'income',
    name: 'Income',
    color: '#10b981', // emerald-500
    icon: '💰',
    isDefault: true,
  },
  {
    id: 'other',
    name: 'Other',
    color: '#6b7280', // gray-500
    icon: '📦',
    isDefault: true,
  },
];

// 카테고리 이름으로 카테고리 찾기
export function getCategoryByName(name: string): Category | undefined {
  return DEFAULT_CATEGORIES.find(
    (cat) => cat.name.toLowerCase() === name.toLowerCase()
  );
}

// 카테고리 ID로 카테고리 찾기
export function getCategoryById(id: string): Category | undefined {
  return DEFAULT_CATEGORIES.find((cat) => cat.id === id);
}

// ID 또는 이름으로 카테고리 찾기 (트랜잭션 표시용 - AI는 name 저장)
export function getCategoryForDisplay(value: string): Category | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const v = value.trim();
  const byId = getCategoryById(v.toLowerCase());
  if (byId) return byId;
  const byName = getCategoryByName(v);
  if (byName) return byName;
  // Legacy: "Food" -> Food and Grocery
  if (v.toLowerCase() === 'food') return DEFAULT_CATEGORIES.find((c) => c.id === 'food');
  return undefined;
}

// 카테고리 이름 목록 (AI 프롬프트용)
export function getCategoryNames(): string[] {
  return DEFAULT_CATEGORIES.map((cat) => cat.name);
}
