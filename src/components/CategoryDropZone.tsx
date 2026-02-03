'use client';

import { useDroppable } from '@dnd-kit/core';
import { Category, CategorizedTransaction } from '@/types';
import TransactionCard from './TransactionCard';

interface CategoryDropZoneProps {
  category: Category;
  transactions: CategorizedTransaction[];
  onEditTransaction: (transaction: CategorizedTransaction) => void;
  onDeleteTransaction: (transaction: CategorizedTransaction) => void;
}

export default function CategoryDropZone({
  category,
  transactions,
  onEditTransaction,
  onDeleteTransaction,
}: CategoryDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: category.id,
  });

  const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div
      ref={setNodeRef}
      className={`
        bg-white rounded-xl border-2 transition-all duration-200 min-h-[200px]
        ${isOver ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-gray-200'}
      `}
    >
      {/* 헤더 */}
      <div
        className="p-4 border-b border-gray-100 rounded-t-xl"
        style={{ backgroundColor: `${category.color}15` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">{category.icon}</span>
            <h3 className="font-semibold text-gray-800">{category.name}</h3>
          </div>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {transactions.length}
          </span>
        </div>
        {transactions.length > 0 && (
          <p className="text-sm text-gray-500 mt-1">
            Total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {/* 거래 목록 */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Drop transactions here
          </div>
        ) : (
          transactions.map((transaction) => (
            <TransactionCard
              key={`${transaction.date}-${transaction.description}-${transaction.amount}`}
              transaction={transaction}
              onClick={() => onEditTransaction(transaction)}
              onDelete={() => onDeleteTransaction(transaction)}
            />
          ))
        )}
      </div>
    </div>
  );
}
