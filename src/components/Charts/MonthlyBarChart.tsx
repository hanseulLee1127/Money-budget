'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Transaction } from '@/types';
import { format, subMonths, addMonths } from 'date-fns';

interface MonthlyBarChartProps {
  transactions: Transaction[];
  selectedMonth: string; // "yyyy-MM" 형식
  onMonthClick?: (month: string) => void; // 막대 클릭 시 호출
}

export default function MonthlyBarChart({ transactions, selectedMonth, onMonthClick }: MonthlyBarChartProps) {
  // 확정된 거래만 필터
  const confirmedTransactions = transactions.filter((t) => t.isConfirmed);

  // 선택된 월을 기준으로 앞뒤 3달씩 (총 7개월) 표시
  const [year, month] = selectedMonth.split('-').map(Number);
  const baseDate = new Date(year, month - 1, 15); // 15일로 설정하여 시간대 문제 방지

  const monthlyData = [];

  // -3달부터 +3달까지 (선택된 달이 가운데)
  for (let i = -3; i <= 3; i++) {
    const targetDate = i < 0 ? subMonths(baseDate, Math.abs(i)) : addMonths(baseDate, i);
    const monthKey = format(targetDate, 'yyyy-MM');
    const monthLabel = format(targetDate, 'MMM');
    const yearLabel = format(targetDate, 'yy');

    const monthlyTotal = confirmedTransactions
      .filter((t) => t.amount < 0 && t.date && t.date.startsWith(monthKey))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    monthlyData.push({
      month: `${monthLabel} '${yearLabel}`,
      monthKey: monthKey,
      spending: monthlyTotal,
      isSelected: monthKey === selectedMonth,
    });
  }

  // 막대 클릭 핸들러
  const handleBarClick = (data: { monthKey: string }) => {
    if (onMonthClick && data.monthKey) {
      onMonthClick(data.monthKey);
    }
  };

  if (confirmedTransactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-slate-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart
        data={monthlyData}
        onClick={onMonthClick ? (e) => {
          const payload = (e as { activePayload?: { payload: { monthKey: string } }[] })?.activePayload?.[0]?.payload;
          if (payload) handleBarClick(payload);
        } : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value: number | undefined) => [
            value != null ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '',
            'Spending',
          ]}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
            fontSize: '13px',
          }}
          labelStyle={{
            color: '#1e293b',
            fontWeight: '600',
          }}
          cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
        />
        <Bar dataKey="spending" radius={[6, 6, 0, 0]} style={{ cursor: onMonthClick ? 'pointer' : 'default' }}>
          {monthlyData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isSelected ? '#2563eb' : '#dbeafe'}
              stroke={entry.isSelected ? '#1d4ed8' : 'transparent'}
              strokeWidth={entry.isSelected ? 2 : 0}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
