'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getCategoryById } from '@/lib/categories';

interface CategoryTotal {
  category: string;
  total: number;
}

interface SpendingPieChartProps {
  data: CategoryTotal[];
}

export default function SpendingPieChart({ data }: SpendingPieChartProps) {
  const chartData = data.map((item) => {
    const category = getCategoryById(item.category.toLowerCase());
    return {
      name: item.category,
      value: item.total,
      color: category?.color || '#6b7280',
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-56 text-gray-400">
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
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | undefined) => 
            value != null ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''
          }
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
