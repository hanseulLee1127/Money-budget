'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getCategoryForDisplay } from '@/lib/categories';

interface CategoryTotal {
  category: string;
  total: number;
}

interface SpendingPieChartProps {
  data: CategoryTotal[];
}

export default function SpendingPieChart({ data }: SpendingPieChartProps) {
  const totalSpending = data.reduce((sum, item) => sum + item.total, 0);

  const chartData = data.map((item) => {
    const category = getCategoryForDisplay(item.category);
    return {
      name: item.category,
      value: item.total,
      color: category?.color || '#6b7280',
      icon: category?.icon || '📦',
      percentage: totalSpending > 0 ? (item.total / totalSpending) * 100 : 0,
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
    <div className="flex flex-col items-center gap-5">
      {/* 도넛 차트 */}
      <div className="relative w-full" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
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
                padding: '8px 12px',
              }}
              labelStyle={{
                color: '#1e293b',
                fontWeight: '600',
                marginBottom: '2px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* 중앙 총액 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-slate-400">Total</span>
          <span className="text-lg font-bold text-slate-800">
            ${totalSpending.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* 카테고리 리스트 */}
      <div className="w-full space-y-2">
        {chartData.slice(0, 6).map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-600 truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-medium text-slate-800">
                ${item.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-400 w-10 text-right">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
        {chartData.length > 6 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-slate-300 flex-shrink-0" />
              <span className="text-sm text-slate-400">+{chartData.length - 6} more</span>
            </div>
            <span className="text-xs text-slate-400">
              ${chartData.slice(6).reduce((s, i) => s + i.value, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
