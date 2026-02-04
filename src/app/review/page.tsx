'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useAuthContext } from '@/components/AuthProvider';
import { CategorizedTransaction } from '@/types';
import { DEFAULT_CATEGORIES, getCategoryById } from '@/lib/categories';
import { addTransactions } from '@/lib/firestore';
import TransactionCard from '@/components/TransactionCard';
import CategoryDropZone from '@/components/CategoryDropZone';
import EditTransactionModal from '@/components/EditTransactionModal';

export default function ReviewPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuthContext();
  const [transactions, setTransactions] = useState<CategorizedTransaction[]>([]);
  const [activeTransaction, setActiveTransaction] = useState<CategorizedTransaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CategorizedTransaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // 인증 체크 (비로그인 시 랜딩 페이지로)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // 세션 스토리지에서 거래 내역 로드
  useEffect(() => {
    const stored = sessionStorage.getItem('categorizedTransactions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTransactions(parsed);
      } catch {
        toast.error('Failed to load transactions');
        router.push('/upload');
      }
    } else {
      router.push('/upload');
    }
  }, [router]);

  const handleDragStart = (event: DragStartEvent) => {
    const transaction = transactions.find(t => 
      `${t.date}-${t.description}-${t.amount}` === event.active.id
    );
    setActiveTransaction(transaction || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTransaction(null);

    if (over && active.id !== over.id) {
      const categoryId = over.id as string;
      const category = getCategoryById(categoryId);
      
      if (category) {
        setTransactions(prev => 
          prev.map(t => {
            const transactionId = `${t.date}-${t.description}-${t.amount}`;
            if (transactionId === active.id) {
              return { ...t, category: category.name };
            }
            return t;
          })
        );
        toast.success(`Moved to ${category.name}`);
      }
    }
  };

  const handleEditTransaction = (transaction: CategorizedTransaction) => {
    setEditingTransaction(transaction);
  };

  const handleSaveEdit = (updated: CategorizedTransaction) => {
    setTransactions(prev =>
      prev.map(t => {
        const originalId = `${editingTransaction?.date}-${editingTransaction?.description}-${editingTransaction?.amount}`;
        const currentId = `${t.date}-${t.description}-${t.amount}`;
        if (originalId === currentId) {
          return updated;
        }
        return t;
      })
    );
    setEditingTransaction(null);
    toast.success('Transaction updated');
  };

  const handleDeleteTransaction = (transaction: CategorizedTransaction) => {
    setTransactions(prev => 
      prev.filter(t => {
        const transactionId = `${t.date}-${t.description}-${t.amount}`;
        const targetId = `${transaction.date}-${transaction.description}-${transaction.amount}`;
        return transactionId !== targetId;
      })
    );
    toast.success('Transaction removed');
  };

  const handleConfirmAll = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // 거래 내역을 Firestore에 저장
      const transactionsToSave = transactions.map(t => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        isConfirmed: true,
      }));

      await addTransactions(user.uid, transactionsToSave);

      // 세션 스토리지 클리어
      sessionStorage.removeItem('categorizedTransactions');

      toast.success(`${transactions.length} transactions saved successfully!`);
      router.push('/dashboard');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save transactions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // 카테고리별로 거래 그룹화
  const transactionsByCategory = DEFAULT_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = transactions.filter(
      t => t.category.toLowerCase() === category.name.toLowerCase()
    );
    return acc;
  }, {} as Record<string, CategorizedTransaction[]>);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link href="/dashboard" className="text-lg sm:text-2xl font-bold text-blue-600 truncate min-w-0">
              Money Budget
            </Link>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 flex-shrink-0">
              <span className="text-sm text-gray-500">
                {transactions.length} transactions
              </span>
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
              >
                Cancel
              </Link>
              <button
                onClick={handleConfirmAll}
                disabled={isSaving || transactions.length === 0}
                className="px-4 py-2 sm:px-6 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSaving ? 'Saving...' : 'Confirm All'}
              </button>
              <button
                onClick={handleSignOut}
                className="px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-600 hover:text-gray-800 transition whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">Review Transactions</h1>
          <p className="text-gray-600">
            Drag transactions between categories to reclassify them, or click to edit details.
          </p>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {DEFAULT_CATEGORIES.map(category => (
              <CategoryDropZone
                key={category.id}
                category={category}
                transactions={transactionsByCategory[category.id] || []}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTransaction ? (
              <TransactionCard
                transaction={activeTransaction}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* 편집 모달 */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onSave={handleSaveEdit}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
}
