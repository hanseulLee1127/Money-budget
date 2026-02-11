'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthContext } from '@/components/AuthProvider';
import { getTransactions, getCategoryTotals, addTransaction, addRecurringTransaction, deleteTransaction, updateTransaction, deleteTransactionsByMonth, generateRecurringTransactions, deleteRecurringSeries, recordRecurringDeletedDate } from '@/lib/firestore';
import { Transaction } from '@/types';
import { getCategoryForDisplay, DEFAULT_CATEGORIES } from '@/lib/categories';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import SpendingPieChart from '@/components/Charts/SpendingPieChart';
import MonthlyBarChart from '@/components/Charts/MonthlyBarChart';
import AddTransactionModal from '@/components/AddTransactionModal';
import EditTransactionModal from '@/components/EditTransactionModal';
import DeleteRecurringModal from '@/components/DeleteRecurringModal';
import SubscriptionModal from '@/components/SubscriptionModal';
import InsightsTab from '@/components/InsightsTab';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuthContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<{ category: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingRecurringTransaction, setDeletingRecurringTransaction] = useState<Transaction | null>(null);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<Transaction | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'calendar' | 'insights'>('overview');
  
  // 월별 필터 상태 (초기값은 빈 문자열, useEffect에서 설정)
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  
  // 카테고리 상세 보기 상태
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // 카드 클릭 필터 상태
  const [cardFilter, setCardFilter] = useState<'all' | 'spending' | 'income' | 'count' | null>(null);
  
  // 캘린더에서 선택된 날짜
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // 캘린더 아래 화살표 점등: 아이템 있는 날 클릭 시 3초 후 사라짐
  const [showCalendarDownArrow, setShowCalendarDownArrow] = useState(false);

  // Insights 탭: 미완성이라 숨김. true로 바꾸면 탭 노출
  const SHOW_INSIGHTS_TAB = false;

  // 월 문자열을 안전하게 Date로 변환 (시간대 문제 방지)
  const parseMonthString = (monthStr: string): Date => {
    if (!monthStr) return new Date();
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month - 1, 15); // 15일로 설정하여 시간대 문제 방지
  };

  // 월 포맷팅 함수
  const formatMonth = (monthStr: string): string => {
    if (!monthStr) return '';
    const date = parseMonthString(monthStr);
    return format(date, 'MMMM yyyy');
  };

  // 인증 체크 (비로그인 시 랜딩 페이지로)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // 대시보드 진입 시 Firestore users 문서 없으면 서버에서 생성
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) => {
      fetch('/api/user/ensure-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).catch(() => {});
    });
  }, [user?.uid]);

  // Stripe 구독 성공/취소 후 리다이렉트 시: 유저·구독 동기화 후 토스트
  useEffect(() => {
    const sub = searchParams.get('subscription');
    const sessionId = searchParams.get('session_id');
    if (sub === 'cancelled') {
      toast('Checkout cancelled.');
      router.replace('/dashboard', { scroll: false });
      return;
    }
    if (sub === 'success' && user) {
      (async () => {
        try {
          const token = await user.getIdToken();
          await fetch('/api/user/ensure-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          });
          if (sessionId) {
            const res = await fetch('/api/stripe/confirm-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ session_id: sessionId }),
            });
            if (res.ok) {
              toast.success('Subscription activated. You can upload more PDFs now.');
            } else {
              toast.success('Welcome back. If your plan does not show, open Subscription to refresh.');
            }
          } else {
            toast.success('Subscription activated. You can upload more PDFs now.');
          }
        } catch {
          toast.success('Welcome back. If your plan does not show, open Subscription to refresh.');
        }
        router.replace('/dashboard', { scroll: false });
      })();
    }
  }, [searchParams, router, user]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 1. Recurring 거래 자동 생성
      await generateRecurringTransactions(user.uid);
      
      // 2. 거래 내역 및 카테고리 합계 로드
      const [txns, totals] = await Promise.all([
        getTransactions(user.uid),
        getCategoryTotals(user.uid),
      ]);
      setTransactions(txns);
      setCategoryTotals(totals);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleAddTransaction = async (newTransaction: {
    date: string;
    description: string;
    amount: number;
    category: string;
    isRecurring?: boolean;
    recurringFrequency?: 'monthly' | 'bi-weekly' | 'weekly';
    recurringDay?: number;
  }) => {
    if (!user) return;

    try {
      if (newTransaction.isRecurring && newTransaction.recurringFrequency && newTransaction.recurringDay !== undefined) {
        const ids = await addRecurringTransaction(user.uid, {
          date: newTransaction.date,
          description: newTransaction.description,
          amount: newTransaction.amount,
          category: newTransaction.category,
          recurringFrequency: newTransaction.recurringFrequency,
          recurringDay: newTransaction.recurringDay,
        });
        toast.success(
          ids.length === 1
            ? `Recurring transaction added (${newTransaction.recurringFrequency})`
            : `Added ${ids.length} recurring transactions through this month (${newTransaction.recurringFrequency})`
        );
      } else {
        await addTransaction(user.uid, {
          ...newTransaction,
          isConfirmed: true,
          ...(newTransaction.isRecurring && {
            isRecurring: true,
            recurringFrequency: newTransaction.recurringFrequency || 'monthly',
            recurringDay: newTransaction.recurringDay,
          }),
        });
        toast.success('Transaction added successfully');
      }
      setShowAddModal(false);
      loadData();
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error('Failed to add transaction');
    }
  };

  const handleEditTransaction = async (updated: Transaction) => {
    if (!user || !editingTransaction) return;

    try {
      const updatedAny = updated as any;
      await updateTransaction(user.uid, editingTransaction.id, {
        date: updated.date,
        description: updated.description,
        amount: updated.amount,
        category: updated.category,
        isRecurring: updatedAny.isRecurring,
        recurringFrequency: updatedAny.recurringFrequency,
        recurringDay: updatedAny.recurringDay,
      });
      toast.success('Transaction updated');
      setEditingTransaction(null);
      loadData();
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
    }
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    if (transaction.isRecurring) {
      setDeletingRecurringTransaction(transaction);
      return;
    }
    setPendingDeleteTransaction(transaction);
  };

  const confirmDeleteTransaction = async () => {
    if (!user || !pendingDeleteTransaction) return;
    try {
      await deleteTransaction(user.uid, pendingDeleteTransaction.id);
      toast.success('Transaction deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    } finally {
      setPendingDeleteTransaction(null);
    }
  };

  // Recurring 거래 삭제 - 이 거래만 (삭제한 날짜 기록 → 자동 생성 시 다시 만들지 않음)
  const handleDeleteRecurringThis = async () => {
    if (!user || !deletingRecurringTransaction) return;

    try {
      await recordRecurringDeletedDate(user.uid, deletingRecurringTransaction);
      await deleteTransaction(user.uid, deletingRecurringTransaction.id);
      toast.success('Transaction deleted');
      setDeletingRecurringTransaction(null);
      loadData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    }
  };

  // Recurring 거래 삭제 - 전체 시리즈
  const handleDeleteRecurringAll = async () => {
    if (!user || !deletingRecurringTransaction) return;

    try {
      const deletedCount = await deleteRecurringSeries(user.uid, deletingRecurringTransaction);
      toast.success(`Deleted ${deletedCount} recurring transactions`);
      setDeletingRecurringTransaction(null);
      loadData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    }
  };

  // 캘린더 월 네비게이션: 데이터가 있는 달만 이동 (데이터 없는 달은 패스)
  const handlePreviousMonth = () => {
    if (!selectedMonth || availableMonths.length === 0) return;
    const prevMonths = availableMonths.filter((m) => m < selectedMonth);
    const prevMonth = prevMonths[0]; // 내림차순이므로 첫 번째가 selectedMonth 바로 이전 달(데이터 있음)
    if (prevMonth) setSelectedMonth(prevMonth);
  };

  const handleNextMonth = () => {
    if (!selectedMonth || availableMonths.length === 0) return;
    const nextMonths = availableMonths.filter((m) => m > selectedMonth);
    const nextMonth = nextMonths[nextMonths.length - 1]; // 내림차순이므로 마지막이 selectedMonth 바로 다음 달(데이터 있음)
    if (nextMonth) setSelectedMonth(nextMonth);
  };

  const handleResetDashboard = useCallback(() => {
    setActiveTab('overview');
    setSelectedCategory(null);
    setCardFilter(null);
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
    setSelectedDate(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // Delete All 모달 열기
  const handleDeleteAllFilteredTransactions = () => {
    if (filteredTransactions.length === 0) return;
    setShowDeleteAllModal(true);
  };

  // Delete All 확정 실행
  const confirmDeleteAllFilteredTransactions = async () => {
    if (!user) return;
    const count = filteredTransactions.length;
    if (count === 0) return;

    try {
      setLoading(true);
      let deletedCount = 0;
      for (const transaction of filteredTransactions) {
        await deleteTransaction(user.uid, transaction.id);
        deletedCount++;
      }
      toast.success(`Deleted ${deletedCount} transactions`);
      loadData();
      setShowDeleteAllModal(false);
    } catch (error) {
      console.error('Error deleting transactions:', error);
      toast.error('Failed to delete transactions');
    } finally {
      setLoading(false);
    }
  };

  // 확정된 거래만 필터
  const confirmedTransactions = useMemo(() => 
    transactions.filter((t) => t.isConfirmed), 
    [transactions]
  );

  // 사용 가능한 월 목록 생성
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    confirmedTransactions.forEach((t) => {
      if (t.date) {
        months.add(t.date.substring(0, 7));
      }
    });
    const sorted = Array.from(months).sort().reverse();
    // 데이터가 없으면 현재 월 추가
    if (sorted.length === 0) {
      const currentMonth = format(new Date(), 'yyyy-MM');
      sorted.push(currentMonth);
    }
    return sorted;
  }, [confirmedTransactions]);

  // 초기 월 선택: 데이터가 있는 달만 표시 (없는 달이면 가장 최근 달로)
  useEffect(() => {
    if (availableMonths.length > 0) {
      if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
        setSelectedMonth(availableMonths[0]);
      }
    }
  }, [availableMonths, selectedMonth]);

  // 선택된 월의 거래
  const monthlyTransactions = useMemo(() => {
    if (!selectedMonth) return [];
    return confirmedTransactions.filter((t) => t.date?.startsWith(selectedMonth));
  }, [confirmedTransactions, selectedMonth]);

  // 선택된 월 지출 계산
  const monthlySpending = useMemo(() => 
    monthlyTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [monthlyTransactions]
  );

  // 선택된 월 수입 계산
  const monthlyIncome = useMemo(() => 
    monthlyTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0),
    [monthlyTransactions]
  );

  // 선택된 월 지출 카테고리별 총계
  const monthlyCategoryTotals = useMemo(() => {
    const totals: { [key: string]: number } = {};
    monthlyTransactions
      .filter((t) => t.amount < 0)
      .forEach((t) => {
        const cat = t.category || 'Other';
        totals[cat] = (totals[cat] || 0) + Math.abs(t.amount);
      });
    return Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthlyTransactions]);

  // 선택된 월 수입 카테고리별 총계
  const monthlyIncomeCategoryTotals = useMemo(() => {
    const totals: { [key: string]: number } = {};
    monthlyTransactions
      .filter((t) => t.amount > 0)
      .forEach((t) => {
        const cat = t.category || 'Other';
        totals[cat] = (totals[cat] || 0) + t.amount;
      });
    return Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthlyTransactions]);

  // 연간 총계 계산
  const currentYear = selectedMonth.substring(0, 4);
  const yearlyTransactions = useMemo(() => 
    confirmedTransactions.filter((t) => t.date?.startsWith(currentYear)),
    [confirmedTransactions, currentYear]
  );

  const yearlySpending = useMemo(() => 
    yearlyTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    [yearlyTransactions]
  );

  const yearlyIncome = useMemo(() => 
    yearlyTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0),
    [yearlyTransactions]
  );

  // 필터된 거래 (카드/카테고리 클릭 시)
  const filteredTransactions = useMemo(() => {
    let filtered = monthlyTransactions;
    
    if (cardFilter === 'spending') {
      filtered = filtered.filter((t) => t.amount < 0);
    } else if (cardFilter === 'income') {
      filtered = filtered.filter((t) => t.amount > 0);
    }
    
    if (selectedCategory) {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }
    
    return filtered;
  }, [monthlyTransactions, cardFilter, selectedCategory]);

  // 캘린더 데이터 - 날짜별 총액 계산
  const calendarData = useMemo(() => {
    const dailyTotals: { [date: string]: { spending: number; income: number } } = {};
    
    monthlyTransactions.forEach((t) => {
      if (!t.date) return;
      if (!dailyTotals[t.date]) {
        dailyTotals[t.date] = { spending: 0, income: 0 };
      }
      if (t.amount < 0) {
        dailyTotals[t.date].spending += Math.abs(t.amount);
      } else {
        dailyTotals[t.date].income += t.amount;
      }
    });
    
    return dailyTotals;
  }, [monthlyTransactions]);

  // 선택된 날짜의 거래
  const selectedDateTransactions = useMemo(() => {
    if (!selectedDate) return [];
    return monthlyTransactions.filter((t) => t.date === selectedDate);
  }, [monthlyTransactions, selectedDate]);

  // 캘린더 날짜 배열 생성
  const calendarDays = useMemo(() => {
    if (!selectedMonth) return [];
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // 시작 요일에 맞춰 빈 칸 추가 (일요일 = 0)
    const startDay = getDay(monthStart);
    const emptyDays = Array(startDay).fill(null);
    
    return [...emptyDays, ...days];
  }, [selectedMonth]);

  // 아이템 있는 날 클릭 시 아래 화살표 3초 점등 후 사라짐
  useEffect(() => {
    if (selectedDate && selectedDateTransactions.length > 0) {
      setShowCalendarDownArrow(true);
      const t = setTimeout(() => setShowCalendarDownArrow(false), 3000);
      return () => clearTimeout(t);
    } else {
      setShowCalendarDownArrow(false);
    }
  }, [selectedDate, selectedDateTransactions.length]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 네비게이션 - Monarch style */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleResetDashboard}
              className="text-xl sm:text-2xl font-bold text-slate-900 hover:text-blue-600 transition truncate min-w-0 text-left tracking-tight"
            >
              Money Budget
            </button>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Link
                href="/upload"
                className="px-3 py-2 sm:px-4 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap font-medium"
              >
                Upload
              </Link>
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="px-3 py-2 sm:px-4 text-sm sm:text-base text-slate-500 hover:text-slate-700 transition whitespace-nowrap"
              >
                Subscription
              </button>
              <button
                onClick={handleSignOut}
                className="px-3 py-2 sm:px-4 text-sm sm:text-base text-slate-500 hover:text-slate-700 transition whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <button
              onClick={handleResetDashboard}
              className="text-2xl sm:text-3xl font-bold text-slate-900 hover:text-blue-600 transition text-left tracking-tight"
            >
              Dashboard
            </button>
            <p className="text-sm text-slate-400 mt-1">{formatMonth(selectedMonth)}</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3">
            {/* 월 선택기 */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
              }}
              className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>

            {/* 탭 */}
            <div className="flex overflow-x-auto pb-1 sm:pb-0 -mx-1 sm:mx-0">
              <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl min-w-0">
              <button
                onClick={() => {
                  setActiveTab('overview');
                  setCardFilter(null);
                  setSelectedCategory(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'overview'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => {
                  setActiveTab('transactions');
                  setCardFilter('spending');
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'transactions'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Transactions
              </button>
              <button
                onClick={() => {
                  setActiveTab('calendar');
                  setSelectedDate(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === 'calendar'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Calendar
              </button>
              {SHOW_INSIGHTS_TAB && (
                <button
                  onClick={() => {
                    setActiveTab('insights');
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === 'insights'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Insights
                </button>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* 요약 카드와 총계는 캘린더 및 Insights 탭에서 숨김 */}
        {activeTab !== 'calendar' && activeTab !== 'insights' && (
          <>
            {/* 요약 카드 - 클릭 가능 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                onClick={() => {
                  setCardFilter('spending');
                  setSelectedCategory(null);
                  setActiveTab('transactions');
                }}
                className={`bg-white p-4 sm:p-5 rounded-2xl border text-left transition-all hover:shadow-md ${
                  cardFilter === 'spending' ? 'border-red-300 ring-2 ring-red-100 shadow-md' : 'border-slate-100 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>
                  </div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Spending</h3>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-500">
                  ${monthlySpending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </button>

              <button
                onClick={() => {
                  setCardFilter('income');
                  setSelectedCategory(null);
                  setActiveTab('transactions');
                }}
                className={`bg-white p-4 sm:p-5 rounded-2xl border text-left transition-all hover:shadow-md ${
                  cardFilter === 'income' ? 'border-blue-300 ring-2 ring-blue-100 shadow-md' : 'border-slate-100 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                  </div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Income</h3>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">
                  ${monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </button>

              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                  </div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Net</h3>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${monthlyIncome - monthlySpending >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {monthlyIncome - monthlySpending >= 0 ? '+' : '-'}$
                  {Math.abs(monthlyIncome - monthlySpending).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Count</h3>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-800">
                  {monthlyTransactions.length}
                </p>
              </div>
            </div>

            {/* 연간 총계 (Overview) 또는 필터 총계 (Transactions) */}
            {activeTab === 'overview' ? (
              <div className="bg-white p-4 sm:p-5 rounded-2xl mb-6 sm:mb-8 border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
                  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    {currentYear} Year Total
                  </h3>
                  <div className="flex flex-wrap gap-6 sm:gap-8">
                    <div>
                      <span className="text-xs text-slate-400">Income</span>
                      <p className="text-lg font-bold text-blue-600">
                        ${yearlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Spending</span>
                      <p className="text-lg font-bold text-red-500">
                        ${yearlySpending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Net</span>
                      <p className={`text-lg font-bold ${yearlyIncome - yearlySpending >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {yearlyIncome - yearlySpending >= 0 ? '+' : '-'}$
                        {Math.abs(yearlyIncome - yearlySpending).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Count</span>
                      <p className="text-lg font-bold text-slate-800">
                        {yearlyTransactions.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 sm:p-5 rounded-2xl mb-6 sm:mb-8 border border-slate-100 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-slate-600">
                      {selectedCategory ? `${selectedCategory} - ` : ''}
                      {cardFilter === 'spending' ? 'Expenses' : cardFilter === 'income' ? 'Income' : 'All Transactions'}
                      {' for '}
                      {formatMonth(selectedMonth)}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-6 sm:gap-8">
                    <div>
                      <span className="text-xs text-slate-400">Total</span>
                      <p className="text-lg font-bold text-slate-800">
                        ${filteredTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Count</span>
                      <p className="text-lg font-bold text-slate-800">
                        {filteredTransactions.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'overview' && (
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* 카테고리별 파이 차트 */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 [&_*]:outline-none min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-5">
                Spending by Category
              </h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
                </div>
              ) : (
                <SpendingPieChart data={monthlyCategoryTotals} />
              )}
            </div>

            {/* 월별 지출 바 차트 */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 [&_*]:outline-none min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-5">Monthly Spending Trend</h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
                </div>
              ) : (
                <MonthlyBarChart 
                  transactions={confirmedTransactions} 
                  selectedMonth={selectedMonth}
                />
              )}
            </div>

            {/* 카테고리별 상세 - 클릭 가능 */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 min-w-0">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base sm:text-lg font-semibold text-slate-800">
                  Category Breakdown
                </h2>
                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
                </div>
              ) : monthlyCategoryTotals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No transactions for this month</p>
                  <Link href="/upload" className="text-blue-600 hover:text-blue-700 font-medium">
                    Upload a statement
                  </Link>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {monthlyCategoryTotals.map((item) => {
                    const category = getCategoryForDisplay(item.category);
                    const percentage = monthlySpending > 0 ? (item.total / monthlySpending) * 100 : 0;
                    const isSelected = selectedCategory === item.category;

                    return (
                      <button
                        key={item.category}
                        onClick={() => {
                          setSelectedCategory(item.category);
                          setCardFilter(null);
                          setActiveTab('transactions');
                        }}
                        className={`p-4 rounded-xl border text-left transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-blue-300 ring-2 ring-blue-100 bg-blue-50/50'
                            : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${category?.color}15` }}>
                            {category?.icon || '📦'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-medium text-slate-800 text-sm truncate">{item.category}</h3>
                            <p className="text-xs text-slate-400">{percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-slate-800">
                          ${item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: category?.color || '#6b7280',
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          /* 거래 내역 탭 */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* 헤더 */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
                Transactions for {formatMonth(selectedMonth)}
              </h2>
              {filteredTransactions.length > 0 && (
                <button
                  onClick={handleDeleteAllFilteredTransactions}
                  className="px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete All ({filteredTransactions.length})
                </button>
              )}
            </div>
            
            {/* 카테고리 필터 버튼들 - 필터에 따라 다른 카테고리 표시 */}
            {(() => {
              // 현재 필터에 맞는 카테고리 목록 선택
              const categoryList = cardFilter === 'income' ? monthlyIncomeCategoryTotals : monthlyCategoryTotals;
              const relevantTransactions = cardFilter === 'income' 
                ? monthlyTransactions.filter(t => t.amount > 0)
                : monthlyTransactions.filter(t => t.amount < 0);
              
              if (categoryList.length === 0) return null;
              
              return (
                <div className="px-4 sm:px-6 py-3 border-b border-gray-100 overflow-x-auto -mx-1">
                  <div className="flex items-center gap-2 flex-nowrap">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                        !selectedCategory 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    {categoryList.map((item) => {
                      const category = getCategoryForDisplay(item.category);
                      const isSelected = selectedCategory === item.category;
                      const count = relevantTransactions.filter(t => t.category === item.category).length;
                      
                      return (
                        <button
                          key={item.category}
                          onClick={() => setSelectedCategory(isSelected ? null : item.category)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition flex items-center gap-1 ${
                            isSelected 
                              ? 'ring-2 ring-offset-1' 
                              : 'hover:opacity-80'
                          }`}
                          style={{ 
                            backgroundColor: `${category?.color}20`, 
                            color: category?.color,
                            ...(isSelected && { ringColor: category?.color })
                          }}
                        >
                          <span>{category?.icon}</span>
                          <span>{item.category}</span>
                          <span className="text-xs opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            
            {/* 데스크톱: 테이블 / 모바일: 카드 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-0">Description</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Category</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-26">Amount</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-30">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        {monthlyTransactions.length === 0 ? (
                          <>
                            No transactions for {formatMonth(selectedMonth)}.{' '}
                            <button
                              onClick={() => setShowAddModal(true)}
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Add a transaction
                            </button>
                          </>
                        ) : (
                          'No matching transactions.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction) => {
                      const category = getCategoryForDisplay(transaction.category);
                      
                      return (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 w-28">
                            {transaction.date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 min-w-0 overflow-hidden">
                            <span className="block truncate max-w-full" title={transaction.description}>{transaction.description}</span>
                          </td>
                          <td className="px-3 py-3 w-40 text-center">
                            <button
                              onClick={() => {
                                setSelectedCategory(transaction.category);
                                setCardFilter(null);
                              }}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition whitespace-nowrap"
                              style={{ backgroundColor: `${category?.color}20`, color: category?.color }}
                            >
                              {category?.icon} {transaction.category}
                            </button>
                          </td>
                          <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium text-right w-26 ${
                            transaction.amount < 0 ? 'text-red-500' : 'text-blue-600'
                          }`}>
                            {transaction.amount < 0 ? '-' : '+'}$
                            {Math.abs(transaction.amount).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right text-sm w-30">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingTransaction(transaction)}
                                className="w-8 h-8 rounded-full bg-blue-50 text-lg hover:bg-blue-100 transition"
                                title="Edit transaction"
                                aria-label="Edit transaction"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(transaction)}
                                className="w-8 h-8 rounded-full bg-red-50 text-lg hover:bg-red-100 transition"
                                title="Delete transaction"
                                aria-label="Delete transaction"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 모바일: 카드 레이아웃 */}
            <div className="md:hidden divide-y divide-gray-200">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-gray-500 px-4">
                  {monthlyTransactions.length === 0 ? (
                    <>
                      No transactions for {formatMonth(selectedMonth)}.{' '}
                      <button onClick={() => setShowAddModal(true)} className="text-blue-600 hover:text-blue-700 font-medium">
                        Add a transaction
                      </button>
                    </>
                  ) : (
                    'No matching transactions.'
                  )}
                </div>
              ) : (
                filteredTransactions.map((transaction) => {
                  const category = getCategoryForDisplay(transaction.category);
                  return (
                    <div key={transaction.id} className="p-4 bg-white hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-sm truncate">{transaction.description}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500">{transaction.date}</span>
                            <button
                              onClick={() => { setSelectedCategory(transaction.category); setCardFilter(null); }}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                              style={{ backgroundColor: `${category?.color}20`, color: category?.color }}
                            >
                              {category?.icon} {transaction.category}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className={`text-base font-bold ${transaction.amount < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                            {transaction.amount < 0 ? '-' : '+'}$
                            {Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingTransaction(transaction)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteTransaction(transaction)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* 거래 수 표시 */}
            {filteredTransactions.length > 0 && (
              <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                Showing {filteredTransactions.length} of {monthlyTransactions.length} transactions
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (() => {
          const canGoPrev = !!selectedMonth && availableMonths.some((m) => m < selectedMonth);
          const canGoNext = !!selectedMonth && availableMonths.some((m) => m > selectedMonth);

          return (
            /* 캘린더 탭: 캘린더와 아래 리스트 같은 너비 */
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-2 sm:gap-4">
                {/* 왼쪽: 캘린더 + 선택일 거래 리스트 (동일 너비) */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                {/* 캘린더 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 md:p-6 overflow-x-auto">
                {/* 월 제목 with 네비게이션 및 요약 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={canGoPrev ? handlePreviousMonth : undefined}
                      disabled={!canGoPrev}
                      className={`p-2 rounded-lg transition ${
                        canGoPrev 
                          ? 'hover:bg-gray-100 text-gray-600 cursor-pointer' 
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                      aria-label="Previous month"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <h2 className="text-2xl font-bold text-gray-900">
                      {formatMonth(selectedMonth)}
                    </h2>
                    
                    <button
                      onClick={canGoNext ? handleNextMonth : undefined}
                      disabled={!canGoNext}
                      className={`p-2 rounded-lg transition ${
                        canGoNext 
                          ? 'hover:bg-gray-100 text-gray-600 cursor-pointer' 
                          : 'text-gray-300 cursor-not-allowed'
                      }`}
                      aria-label="Next month"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                
                {/* 월별 요약 */}
                <div className="flex items-center justify-end gap-6 mt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Spending:</span>
                    <span className="font-semibold text-red-600">
                      -${monthlySpending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Income:</span>
                    <span className="font-semibold text-blue-600">
                      +${monthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-2 pb-3 mb-3 border-b border-gray-300">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <div 
                    key={day} 
                    className={`text-center text-sm font-semibold py-2 ${
                      i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="h-14 sm:h-20" />;
                  }
                  
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayData = calendarData[dateStr];
                  const isSelected = selectedDate === dateStr;
                  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                  const hasData = dayData && (dayData.spending > 0 || dayData.income > 0);
                  const dayOfWeek = getDay(day);
                  
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={`h-14 sm:h-20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all flex flex-col items-start justify-start relative ${
                        isSelected 
                          ? 'bg-blue-500 text-white shadow-lg scale-105' 
                          : isToday 
                            ? 'border-2 border-blue-500 hover:bg-blue-50' 
                            : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`text-sm sm:text-lg font-bold ${
                        isSelected 
                          ? 'text-white' 
                          : isToday 
                            ? 'text-blue-600' 
                            : dayOfWeek === 0 
                              ? 'text-red-500' 
                              : dayOfWeek === 6 
                                ? 'text-blue-500' 
                                : 'text-gray-700'
                      }`}>
                        {format(day, 'd')}
                      </span>
                      {hasData && (
                        <div className="mt-auto w-full space-y-1">
                          {dayData.spending > 0 && (
                            <div className={`text-xs font-bold tracking-tight px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-red-400/30 text-white' : 'bg-red-100 text-red-600'
                            }`}>
                              -{dayData.spending >= 1000 ? (dayData.spending/1000).toFixed(1) + 'k' : '$' + dayData.spending.toFixed(0)}
                            </div>
                          )}
                          {dayData.income > 0 && (
                            <div className={`text-xs font-bold tracking-tight px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-blue-400/30 text-white' : 'bg-blue-100 text-blue-600'
                            }`}>
                              +{dayData.income >= 1000 ? (dayData.income/1000).toFixed(1) + 'k' : '$' + dayData.income.toFixed(0)}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* 범례 */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded" />
                  <span>Today</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-500 font-medium">-$</span>
                  <span>Expense</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-500 font-medium">+$</span>
                  <span>Income</span>
                </div>
              </div>
                </div>

                {/* 선택된 날짜의 거래 목록 (캘린더와 동일 너비) */}
                {selectedDate && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-base font-semibold text-gray-900">
                    {format(new Date(selectedDate + 'T12:00:00'), 'MMMM d, yyyy')}
                  </h3>
                </div>
                
                {selectedDateTransactions.length === 0 ? (
                  <div className="px-5 py-6 text-center text-gray-500">
                    No transactions for this date
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {selectedDateTransactions.map((transaction) => {
                      const category = getCategoryForDisplay(transaction.category);
                      
                      return (
                        <div key={transaction.id} className="px-5 py-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{transaction.description}</p>
                            <span 
                              className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ backgroundColor: `${category?.color}20`, color: category?.color }}
                            >
                              {transaction.category}
                            </span>
                          </div>
                          <span className={`text-base font-bold ${transaction.amount < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                            {transaction.amount < 0 ? '-' : '+'}$
                            {Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* 선택된 날짜 총계 */}
                {selectedDateTransactions.length > 0 && (
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between text-sm">
                    <span className="text-gray-500">
                      {selectedDateTransactions.length} transaction{selectedDateTransactions.length > 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-4">
                      <span className="text-red-600 font-medium">
                        Spent: ${selectedDateTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {selectedDateTransactions.some(t => t.amount > 0) && (
                        <span className="text-blue-600 font-medium">
                          Earned: ${selectedDateTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
                </div>

                {/* 오른쪽 여백: 아이템 있는 날 클릭 시 아래 방향 화살표 - md 이상에서만 */}
                <div className="hidden md:flex w-14 flex-shrink-0 flex-col items-center justify-center min-h-[320px]">
                  {showCalendarDownArrow && (
                    <div className="flex flex-col items-center gap-2 animate-bounce" aria-hidden>
                      {[1, 2].map((i) => (
                        <svg key={i} className="w-8 h-8 text-blue-500 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 9l-7 7-7-7" />
                        </svg>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'insights' && (
          /* Insights 탭 */
          <InsightsTab 
            transactions={confirmedTransactions}
            loading={loading}
          />
        )}
      </main>

      {/* 플로팅 추가 버튼 - 모바일에서 터치 영역 확보 */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-14 h-14 min-w-[56px] min-h-[56px] bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition flex items-center justify-center z-50"
        title="Add Transaction"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* 거래 추가 모달 */}
      {showAddModal && (
        <AddTransactionModal
          onAdd={handleAddTransaction}
          onClose={() => setShowAddModal(false)}
          initialDate={activeTab === 'calendar' && selectedDate ? selectedDate : undefined}
        />
      )}

      {/* 거래 편집 모달 */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={{
            ...editingTransaction,
            rawText: '',
          }}
          onSave={(updated) => handleEditTransaction({
            ...editingTransaction,
            ...updated,
          })}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* 일반 거래 삭제 모달 */}
      {pendingDeleteTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete transaction?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This action cannot be undone.
            </p>
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{pendingDeleteTransaction.description}</span>
                <span className={`whitespace-nowrap font-semibold ${pendingDeleteTransaction.amount < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                  {pendingDeleteTransaction.amount < 0 ? '-' : '+'}$
                  {Math.abs(pendingDeleteTransaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-1 text-xs text-gray-500">{pendingDeleteTransaction.date}</div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPendingDeleteTransaction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTransaction}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring 거래 삭제 모달 */}
      {deletingRecurringTransaction && (
        <DeleteRecurringModal
          onCancel={() => setDeletingRecurringTransaction(null)}
          onDeleteThis={handleDeleteRecurringThis}
          onDeleteAll={handleDeleteRecurringAll}
        />
      )}

      {/* Delete All 커스텀 모달 */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete all filtered transactions?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This action cannot be undone.
            </p>
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
              <div className="font-medium">
                {filteredTransactions.length}{' '}
                {selectedCategory
                  ? `${selectedCategory} transactions`
                  : cardFilter === 'spending'
                    ? 'expense transactions'
                    : cardFilter === 'income'
                      ? 'income transactions'
                      : 'all transactions'}{' '}
                for {formatMonth(selectedMonth)}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAllFilteredTransactions}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubscriptionModal && (
        <SubscriptionModal onClose={() => setShowSubscriptionModal(false)} />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-blue-600" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
