import { Category } from '@/types';

// 기본 카테고리 목록 (세분화된 카테고리)
export const DEFAULT_CATEGORIES: Category[] = [
  // --- Food & Dining ---
  {
    id: 'groceries',
    name: 'Groceries',
    color: '#ef4444', // red-500
    icon: '🛒',
    isDefault: true,
  },
  {
    id: 'restaurants',
    name: 'Restaurants',
    color: '#f97316', // orange-500
    icon: '🍽️',
    isDefault: true,
  },
  {
    id: 'coffee-shops',
    name: 'Coffee Shops',
    color: '#b45309', // amber-700
    icon: '☕',
    isDefault: true,
  },
  // --- Housing ---
  {
    id: 'rent-mortgage',
    name: 'Rent & Mortgage',
    color: '#6366f1', // indigo-500
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
    id: 'internet-phone',
    name: 'Internet & Phone',
    color: '#0ea5e9', // sky-500
    icon: '📶',
    isDefault: true,
  },
  {
    id: 'home-maintenance',
    name: 'Home Maintenance',
    color: '#78716c', // stone-500
    icon: '🔧',
    isDefault: true,
  },
  // --- Transportation ---
  {
    id: 'gas-fuel',
    name: 'Gas & Fuel',
    color: '#ea580c', // orange-600
    icon: '⛽',
    isDefault: true,
  },
  {
    id: 'public-transit',
    name: 'Public Transit',
    color: '#2563eb', // blue-600
    icon: '🚇',
    isDefault: true,
  },
  {
    id: 'car-payment',
    name: 'Car Payment',
    color: '#4f46e5', // indigo-600
    icon: '🚗',
    isDefault: true,
  },
  {
    id: 'parking-tolls',
    name: 'Parking & Tolls',
    color: '#7c3aed', // violet-600
    icon: '🅿️',
    isDefault: true,
  },
  // --- Shopping ---
  {
    id: 'shopping',
    name: 'Shopping',
    color: '#8b5cf6', // violet-500
    icon: '🛍️',
    isDefault: true,
  },
  {
    id: 'clothing',
    name: 'Clothing',
    color: '#a855f7', // purple-500
    icon: '👕',
    isDefault: true,
  },
  {
    id: 'electronics',
    name: 'Electronics',
    color: '#3b82f6', // blue-500
    icon: '🖥️',
    isDefault: true,
  },
  // --- Health ---
  {
    id: 'medical',
    name: 'Medical',
    color: '#ec4899', // pink-500
    icon: '🏥',
    isDefault: true,
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    color: '#f472b6', // pink-400
    icon: '💊',
    isDefault: true,
  },
  {
    id: 'gym-fitness',
    name: 'Gym & Fitness',
    color: '#14b8a6', // teal-500
    icon: '💪',
    isDefault: true,
  },
  // --- Insurance ---
  {
    id: 'insurance',
    name: 'Insurance',
    color: '#0d9488', // teal-600
    icon: '🛡️',
    isDefault: true,
  },
  // --- Entertainment & Lifestyle ---
  {
    id: 'entertainment',
    name: 'Entertainment',
    color: '#06b6d4', // cyan-500
    icon: '🎬',
    isDefault: true,
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    color: '#6366f1', // indigo-500
    icon: '📱',
    isDefault: true,
  },
  {
    id: 'education',
    name: 'Education',
    color: '#0284c7', // sky-600
    icon: '📚',
    isDefault: true,
  },
  {
    id: 'personal-care',
    name: 'Personal Care',
    color: '#d946ef', // fuchsia-500
    icon: '💇',
    isDefault: true,
  },
  {
    id: 'pets',
    name: 'Pets',
    color: '#a3e635', // lime-400
    icon: '🐾',
    isDefault: true,
  },
  {
    id: 'gifts-donations',
    name: 'Gifts & Donations',
    color: '#f43f5e', // rose-500
    icon: '🎁',
    isDefault: true,
  },
  {
    id: 'travel',
    name: 'Travel',
    color: '#0891b2', // cyan-600
    icon: '✈️',
    isDefault: true,
  },
  // --- Income ---
  {
    id: 'income',
    name: 'Income',
    color: '#2563eb', // blue-600
    icon: '💰',
    isDefault: true,
  },
  // --- Other ---
  {
    id: 'other',
    name: 'Other',
    color: '#6b7280', // gray-500
    icon: '📦',
    isDefault: true,
  },
];

// Legacy 카테고리 매핑 (기존 데이터 호환)
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  'food and grocery': 'groceries',
  'food': 'groceries',
  'transportation': 'gas-fuel',
  'housing': 'rent-mortgage',
  'subscription': 'subscriptions',
};

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

  // 1) ID로 직접 매칭
  const byId = getCategoryById(v.toLowerCase());
  if (byId) return byId;

  // 2) 이름으로 직접 매칭
  const byName = getCategoryByName(v);
  if (byName) return byName;

  // 3) Legacy 매핑으로 찾기
  const legacyId = LEGACY_CATEGORY_MAP[v.toLowerCase()];
  if (legacyId) {
    const legacyCat = getCategoryById(legacyId);
    if (legacyCat) return legacyCat;
  }

  return undefined;
}

// 카테고리 이름 목록 (AI 프롬프트용)
export function getCategoryNames(): string[] {
  return DEFAULT_CATEGORIES.map((cat) => cat.name);
}
