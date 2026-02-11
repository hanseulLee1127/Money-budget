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
    recurringEndDate?: string;
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
  const [category, setCategory] = useState('Groceries');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'monthly' | 'bi-weekly' | 'weekly'>('monthly');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState('');

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

      // 종료 날짜 (선택사항)
      if (hasEndDate && recurringEndDate) {
        transactionData.recurringEndDate = recurringEndDate;
      }
    }

    onAdd(transactionData);
  };

  // 카테고리를 expense용과 income용으로 분리
  const expenseCategories = DEFAULT_CATEGORIES.filter(cat => cat.id !== 'income');
  const incomeCategories = DEFAULT_CATEGORIES.filter(cat => cat.id === 'income' || cat.id === 'other');
  const displayCategories = isExpense ? expenseCategories : incomeCategories;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="bg-blue-600 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Add Transaction</h2>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-slate-50/50"
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Grocery shopping"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-slate-50/50 placeholder:text-slate-300"
              required
            />
          </div>

          {/* 금액 및 타입 */}
          <div className="flex space-x-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-slate-50/50 placeholder:text-slate-300"
                  required
                />
              </div>
            </div>

            <div className="w-32">
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Type
              </label>
              <select
                value={isExpense ? 'expense' : 'income'}
                onChange={(e) => {
                  setIsExpense(e.target.value === 'expense');
                  setCategory(e.target.value === 'expense' ? 'Other' : 'Income');
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-slate-50/50"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-800 bg-slate-50/50"
              required
            >
              {displayCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recurring 옵션 */}
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <label htmlFor="recurring" className="text-sm font-medium text-slate-700 cursor-pointer block">
                  Recurring Transaction
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically repeat from the date set through the current month.
                </p>
              </div>
            </div>

            {isRecurring && (
              <div className="ml-7 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Frequency
                  </label>
                  <select
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as 'monthly' | 'bi-weekly' | 'weekly')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-slate-800 bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="has-end-date"
                      checked={hasEndDate}
                      onChange={(e) => {
                        setHasEndDate(e.target.checked);
                        if (!e.target.checked) setRecurringEndDate('');
                      }}
                      className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="has-end-date" className="text-xs font-medium text-slate-500 cursor-pointer">
                      Set end date
                    </label>
                  </div>
                  {hasEndDate && (
                    <input
                      type="date"
                      value={recurringEndDate}
                      min={date}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-slate-800 bg-white"
                    />
                  )}
                  {!hasEndDate && (
                    <p className="text-xs text-slate-400">No end date - repeats indefinitely.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
