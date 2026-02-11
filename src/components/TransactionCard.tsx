'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CategorizedTransaction } from '@/types';

interface TransactionCardProps {
  transaction: CategorizedTransaction;
  isDragging?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function TransactionCard({
  transaction,
  isDragging = false,
  onClick,
  onDelete,
}: TransactionCardProps) {
  const id = `${transaction.date}-${transaction.description}-${transaction.amount}`;
  
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`
        bg-white p-3 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing
        transition-all duration-200 relative
        ${isDragging ? 'shadow-lg scale-105 opacity-90 rotate-2' : 'hover:shadow-md hover:border-blue-300'}
      `}
    >
      {/* 삭제 버튼 */}
      {onDelete && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition z-10"
          style={{ pointerEvents: 'auto' }}
          title="Delete transaction"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      {/* 날짜 */}
      <div className="text-xs text-gray-400 mb-1">{transaction.date}</div>
      
      {/* 설명 */}
      <div className="text-sm font-medium text-gray-800 truncate mb-2" title={transaction.description}>
        {transaction.description}
      </div>
      
      {/* 금액 */}
      <div className={`text-sm font-bold ${
        transaction.amount < 0 ? 'text-red-500' : 'text-blue-600'
      }`}>
        {transaction.amount < 0 ? '-' : '+'}${Math.abs(transaction.amount).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}
