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
      <div className="flex items-center justify-center h-64 text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart 
        data={monthlyData} 
        onClick={onMonthClick ? (e) => e?.activePayload?.[0]?.payload && handleBarClick(e.activePayload[0].payload) : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" stroke="#6b7280" fontSize={11} />
        <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `$${value}`} />
        <Tooltip
          formatter={(value: number) => [
            `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            'Spending',
          ]}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
          labelStyle={{
            color: '#000000',
            fontWeight: 'bold',
          }}
          cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
        />
        <Bar dataKey="spending" radius={[4, 4, 0, 0]} style={{ cursor: onMonthClick ? 'pointer' : 'default' }}>
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
