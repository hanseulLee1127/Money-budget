'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getCategoryForDisplay } from '@/lib/categories';

interface CategoryTotal {
  category: string;
  total: number;
}

interface SpendingPieChartProps {
  data: CategoryTotal[];
}

export default function SpendingPieChart({ data }: SpendingPieChartProps) {
  const chartData = data.map((item) => {
    const category = getCategoryForDisplay(item.category);
    return {
      name: item.category,
      value: item.total,
      color: category?.color || '#6b7280',
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-slate-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={290}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={105}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
          stroke="none"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | undefined) =>
            value != null ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''
          }
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
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#64748b' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
