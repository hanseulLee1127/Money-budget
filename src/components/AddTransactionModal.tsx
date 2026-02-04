'use client';

import { useState, FormEvent } from 'react';
import { DEFAULT_CATEGORIES } from '@/lib/categories';

interface AddTransactionModalProps {
  onAdd: (transaction: {
    date: string;
    description: string;
    amount: number;
    category: string;
    isRecurring?: boolean;
    recurringFrequency?: 'monthly' | 'bi-weekly' | 'weekly';
    recurringDay?: number;
  }) => void;
  onClose: () => void;
  initialDate?: string;
}

export default function AddTransactionModal({
  onAdd,
  onClose,
  initialDate,
}: AddTransactionModalProps) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(initialDate || today);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isExpense, setIsExpense] = useState(true);
  const [category, setCategory] = useState('Other');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'monthly' | 'bi-weekly' | 'weekly'>('monthly');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    const transactionData: any = {
      date,
      description,
      amount: isExpense ? -Math.abs(numericAmount) : Math.abs(numericAmount),
      category,
    };

    if (isRecurring) {
      transactionData.isRecurring = true;
      transactionData.recurringFrequency = recurringFrequency;
      
      // Weekly/Bi-weekly는 요일 저장, Monthly는 날짜 저장
      if (recurringFrequency === 'weekly' || recurringFrequency === 'bi-weekly') {
        transactionData.recurringDay = new Date(date).getDay(); // 0 (일요일) ~ 6 (토요일)
      } else {
        transactionData.recurringDay = new Date(date).getDate(); // 1-31
      }
    }

    onAdd(transactionData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      {/* 모달 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="bg-blue-600 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Add Transaction</h2>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Grocery shopping"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              required
            />
          </div>

          {/* 금액 및 타입 */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  required
                />
              </div>
            </div>

            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={isExpense ? 'expense' : 'income'}
                onChange={(e) => setIsExpense(e.target.value === 'expense')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
              required
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recurring 옵션 */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="recurring" className="text-sm font-medium text-gray-700 cursor-pointer">
                Recurring Transaction - Automatically repeat this transaction
              </label>
            </div>

            {/* Frequency 선택 (체크박스 선택 시에만 표시) */}
            {isRecurring && (
              <div className="ml-7">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Repeat Frequency
                </label>
                <select
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value as 'monthly' | 'bi-weekly' | 'weekly')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-gray-900 bg-white"
                >
                  <option value="monthly">Monthly (every month on the same day)</option>
                  <option value="bi-weekly">Bi-weekly (every 2 weeks)</option>
                  <option value="weekly">Weekly (every week)</option>
                </select>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Add Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
