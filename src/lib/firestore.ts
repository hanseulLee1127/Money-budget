import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, Category, UserProfile, Insight } from '@/types';
import { encryptData, decryptData } from './encryption';
import { DEFAULT_CATEGORIES } from './categories';

// ==================== 사용자 프로필 ====================

/**
 * 새 사용자 프로필 생성
 */
export async function createUserProfile(
  uid: string,
  email: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    email,
    createdAt: Timestamp.now(),
  });

  // 기본 카테고리 생성
  await initializeDefaultCategories(uid);
}

/**
 * 사용자 프로필 조회
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      uid,
      email: data.email,
      displayName: data.displayName,
      createdAt: data.createdAt.toDate(),
    };
  }
  return null;
}

// ==================== 카테고리 ====================

/**
 * 기본 카테고리 초기화
 */
async function initializeDefaultCategories(uid: string): Promise<void> {
  const categoriesRef = collection(db, 'users', uid, 'categories');
  
  for (const category of DEFAULT_CATEGORIES) {
    await addDoc(categoriesRef, {
      ...category,
      createdAt: Timestamp.now(),
    });
  }
}

/**
 * 사용자의 모든 카테고리 조회
 */
export async function getCategories(uid: string): Promise<Category[]> {
  const categoriesRef = collection(db, 'users', uid, 'categories');
  const q = query(categoriesRef, orderBy('name'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Category[];
}

/**
 * 새 카테고리 추가
 */
export async function addCategory(
  uid: string,
  category: Omit<Category, 'id'>
): Promise<string> {
  const categoriesRef = collection(db, 'users', uid, 'categories');
  const docRef = await addDoc(categoriesRef, {
    ...category,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * 카테고리 업데이트
 */
export async function updateCategory(
  uid: string,
  categoryId: string,
  updates: Partial<Category>
): Promise<void> {
  const categoryRef = doc(db, 'users', uid, 'categories', categoryId);
  await updateDoc(categoryRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * 카테고리 삭제
 */
export async function deleteCategory(
  uid: string,
  categoryId: string
): Promise<void> {
  const categoryRef = doc(db, 'users', uid, 'categories', categoryId);
  await deleteDoc(categoryRef);
}

// ==================== 거래 내역 ====================

/**
 * 거래 내역 추가 (암호화 포함)
 */
export async function addTransaction(
  uid: string,
  transaction: Omit<Transaction, 'id' | 'createdAt'>
): Promise<string> {
  const transactionsRef = collection(db, 'users', uid, 'transactions');
  
  // 민감한 데이터 암호화
  const encryptedTransaction = {
    ...transaction,
    description: encryptData(transaction.description),
    amount: encryptData(String(transaction.amount)),
    createdAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(transactionsRef, encryptedTransaction);
  return docRef.id;
}

/**
 * 여러 거래 내역 일괄 추가
 */
export async function addTransactions(
  uid: string,
  transactions: Omit<Transaction, 'id' | 'createdAt'>[]
): Promise<string[]> {
  const ids: string[] = [];
  
  for (const transaction of transactions) {
    const id = await addTransaction(uid, transaction);
    ids.push(id);
  }
  
  return ids;
}

/**
 * 사용자의 모든 거래 내역 조회 (복호화 포함)
 */
export async function getTransactions(uid: string): Promise<Transaction[]> {
  const transactionsRef = collection(db, 'users', uid, 'transactions');
  const q = query(transactionsRef, orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      date: data.date,
      description: decryptData(data.description),
      amount: parseFloat(decryptData(data.amount)),
      category: data.category,
      isConfirmed: data.isConfirmed,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      // Recurring 필드
      isRecurring: data.isRecurring,
      recurringFrequency: data.recurringFrequency,
      recurringDay: data.recurringDay,
    };
  }) as Transaction[];
}

/**
 * 특정 기간의 거래 내역 조회
 */
export async function getTransactionsByDateRange(
  uid: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const transactionsRef = collection(db, 'users', uid, 'transactions');
  const q = query(
    transactionsRef,
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      date: data.date,
      description: decryptData(data.description),
      amount: parseFloat(decryptData(data.amount)),
      category: data.category,
      isConfirmed: data.isConfirmed,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      // Recurring 필드
      isRecurring: data.isRecurring,
      recurringFrequency: data.recurringFrequency,
      recurringDay: data.recurringDay,
    };
  }) as Transaction[];
}

/**
 * 거래 내역 업데이트
 */
export async function updateTransaction(
  uid: string,
  transactionId: string,
  updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>
): Promise<void> {
  const transactionRef = doc(db, 'users', uid, 'transactions', transactionId);
  
  const encryptedUpdates: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };
  
  if (updates.description !== undefined) {
    encryptedUpdates.description = encryptData(updates.description);
  }
  if (updates.amount !== undefined) {
    encryptedUpdates.amount = encryptData(String(updates.amount));
  }
  if (updates.date !== undefined) {
    encryptedUpdates.date = updates.date;
  }
  if (updates.category !== undefined) {
    encryptedUpdates.category = updates.category;
  }
  if (updates.isConfirmed !== undefined) {
    encryptedUpdates.isConfirmed = updates.isConfirmed;
  }
  if (updates.isRecurring !== undefined) {
    encryptedUpdates.isRecurring = updates.isRecurring;
  }
  if (updates.recurringFrequency !== undefined) {
    encryptedUpdates.recurringFrequency = updates.recurringFrequency;
  }
  if (updates.recurringDay !== undefined) {
    encryptedUpdates.recurringDay = updates.recurringDay;
  }
  
  await updateDoc(transactionRef, encryptedUpdates);
}

/**
 * 거래 내역 삭제
 */
export async function deleteTransaction(
  uid: string,
  transactionId: string
): Promise<void> {
  const transactionRef = doc(db, 'users', uid, 'transactions', transactionId);
  await deleteDoc(transactionRef);
}

/**
 * 특정 월의 모든 거래 삭제
 */
export async function deleteTransactionsByMonth(
  uid: string,
  month: string // "yyyy-MM" 형식
): Promise<number> {
  const transactions = await getTransactions(uid);
  const toDelete = transactions.filter((t) => t.date?.startsWith(month));
  
  let deletedCount = 0;
  for (const transaction of toDelete) {
    await deleteTransaction(uid, transaction.id);
    deletedCount++;
  }
  
  return deletedCount;
}

/**
 * Recurring 시리즈 전체 삭제 (모든 같은 recurring 거래)
 */
export async function deleteRecurringSeries(
  uid: string,
  transaction: Transaction
): Promise<number> {
  const allTransactions = await getTransactions(uid);
  
  // 같은 recurring 시리즈의 모든 거래 찾기 (날짜 무관)
  const toDelete = allTransactions.filter(
    (t) =>
      t.description === transaction.description &&
      t.amount === transaction.amount &&
      t.category === transaction.category &&
      t.isRecurring // recurring 거래만
  );
  
  let deletedCount = 0;
  for (const trans of toDelete) {
    await deleteTransaction(uid, trans.id);
    deletedCount++;
  }
  
  return deletedCount;
}

/**
 * 카테고리별 지출 합계 계산
 */
export async function getCategoryTotals(
  uid: string
): Promise<{ category: string; total: number }[]> {
  const transactions = await getTransactions(uid);
  
  const totals = transactions
    .filter((t) => t.isConfirmed && t.amount < 0) // 지출만 (음수)
    .reduce((acc, t) => {
      const existing = acc.find((item) => item.category === t.category);
      if (existing) {
        existing.total += Math.abs(t.amount);
      } else {
        acc.push({ category: t.category, total: Math.abs(t.amount) });
      }
      return acc;
    }, [] as { category: string; total: number }[]);
  
  return totals.sort((a, b) => b.total - a.total);
}

// ==================== Recurring 거래 자동 생성 ====================

/**
 * 다음 발생 날짜 계산
 */
function getNextOccurrence(
  lastDate: string,
  frequency: 'monthly' | 'bi-weekly' | 'weekly',
  recurringDay: number
): string {
  const last = new Date(lastDate);
  
  if (frequency === 'monthly') {
    // 다음 달 같은 날짜
    const nextMonth = new Date(last.getFullYear(), last.getMonth() + 1, recurringDay);
    return nextMonth.toISOString().split('T')[0];
  } else if (frequency === 'bi-weekly') {
    // 2주 후
    const nextDate = new Date(last);
    nextDate.setDate(nextDate.getDate() + 14);
    return nextDate.toISOString().split('T')[0];
  } else {
    // 1주 후
    const nextDate = new Date(last);
    nextDate.setDate(nextDate.getDate() + 7);
    return nextDate.toISOString().split('T')[0];
  }
}

/**
 * 시작일부터 현재 달 마지막일까지의 recurring 발생일 목록 (시작일·현재 달 포함)
 * 예: 1월 20일 monthly 추가 시 이번 달이 2월이면 → [1월 20일, 2월 20일]
 */
function getRecurringOccurrenceDatesFromStartToCurrentMonth(
  startDate: string,
  frequency: 'monthly' | 'bi-weekly' | 'weekly',
  recurringDay: number
): string[] {
  const today = new Date();
  const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endStr = endOfCurrentMonth.toISOString().split('T')[0];
  const dates: string[] = [];
  let current = startDate;
  while (current <= endStr) {
    dates.push(current);
    current = getNextOccurrence(current, frequency, recurringDay);
  }
  return dates;
}

/**
 * Recurring 거래 추가: 시작일부터 현재 달 말까지 모든 발생일을 한 번에 추가
 */
export async function addRecurringTransaction(
  uid: string,
  data: {
    date: string;
    description: string;
    amount: number;
    category: string;
    recurringFrequency: 'monthly' | 'bi-weekly' | 'weekly';
    recurringDay: number;
  }
): Promise<string[]> {
  const dates = getRecurringOccurrenceDatesFromStartToCurrentMonth(
    data.date,
    data.recurringFrequency,
    data.recurringDay
  );
  const transactions = dates.map((date) => ({
    date,
    description: data.description,
    amount: data.amount,
    category: data.category,
    isConfirmed: true,
    isRecurring: true,
    recurringFrequency: data.recurringFrequency,
    recurringDay: data.recurringDay,
  }));
  return addTransactions(uid, transactions);
}

/**
 * Recurring 거래 자동 생성
 */
export async function generateRecurringTransactions(uid: string): Promise<number> {
  const allTransactions = await getTransactions(uid);
  
  // Recurring 거래만 필터링
  const recurringTransactions = allTransactions.filter((t) => t.isRecurring && t.recurringFrequency && t.recurringDay !== undefined);
  
  let generatedCount = 0;
  const today = new Date();
  const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endOfCurrentMonthStr = endOfCurrentMonth.toISOString().split('T')[0];
  
  console.log(`[Recurring] End of current month: ${endOfCurrentMonthStr}, Found ${recurringTransactions.length} recurring transactions`);
  
  for (const recurring of recurringTransactions) {
    console.log(`[Recurring] Processing: ${recurring.description}, Amount: ${recurring.amount}, Frequency: ${recurring.recurringFrequency}`);
    
    // 이 recurring 거래의 가장 최근 발생 찾기
    const sameRecurringTransactions = allTransactions.filter(
      (t) =>
        t.description === recurring.description &&
        t.amount === recurring.amount &&
        t.category === recurring.category
    );
    
    // 가장 최근 날짜
    const lastDate = sameRecurringTransactions.sort((a, b) => b.date.localeCompare(a.date))[0]?.date || recurring.date;
    console.log(`[Recurring] Last occurrence: ${lastDate}`);
    
    // 다음 발생 날짜 계산
    let nextDate = getNextOccurrence(lastDate, recurring.recurringFrequency!, recurring.recurringDay!);
    console.log(`[Recurring] Next occurrence: ${nextDate}, End of month: ${endOfCurrentMonthStr}`);
    
    // 현재 달 말일까지 누락된 거래 생성 (3월 1일 로그인 시 3월 20일 항목도 생성)
    while (nextDate <= endOfCurrentMonthStr) {
      // 이미 해당 날짜에 같은 거래가 있는지 확인
      const exists = allTransactions.some(
        (t) =>
          t.date === nextDate &&
          t.description === recurring.description &&
          Math.abs(t.amount - recurring.amount) < 0.01 &&
          t.category === recurring.category
      );
      
      if (!exists) {
        // 새 거래 생성
        console.log(`[Recurring] Creating new transaction for ${nextDate}`);
        await addTransaction(uid, {
          date: nextDate,
          description: recurring.description,
          amount: recurring.amount,
          category: recurring.category,
          isConfirmed: true,
          isRecurring: true,
          recurringFrequency: recurring.recurringFrequency,
          recurringDay: recurring.recurringDay,
        });
        generatedCount++;
      } else {
        console.log(`[Recurring] Transaction already exists for ${nextDate}`);
      }
      
      // 다음 발생 날짜 계산
      nextDate = getNextOccurrence(nextDate, recurring.recurringFrequency!, recurring.recurringDay!);
    }
  }
  
  console.log(`[Recurring] Generated ${generatedCount} new transactions`);
  return generatedCount;
}

// ==================== Insights (AI 분석) ====================

/**
 * Insight 저장
 */
export async function saveInsight(
  uid: string,
  analysis: string,
  period: string
): Promise<string> {
  const insightsRef = collection(db, 'users', uid, 'insights');
  const docRef = await addDoc(insightsRef, {
    analysis,
    period,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * 모든 Insights 조회 (최신순)
 */
export async function getInsights(uid: string): Promise<Insight[]> {
  const insightsRef = collection(db, 'users', uid, 'insights');
  const q = query(insightsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      analysis: data.analysis,
      period: data.period,
      createdAt: data.createdAt.toDate(),
    };
  }) as Insight[];
}

/**
 * Insight 삭제
 */
export async function deleteInsight(uid: string, insightId: string): Promise<void> {
  const insightRef = doc(db, 'users', uid, 'insights', insightId);
  await deleteDoc(insightRef);
}
