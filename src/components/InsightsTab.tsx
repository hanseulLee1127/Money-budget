'use client';

import { useState, useEffect } from 'react';
import { Transaction, Insight } from '@/types';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { useAuthContext } from '@/components/AuthProvider';
import { getInsights, saveInsight, deleteInsight } from '@/lib/firestore';
import { toast } from 'react-hot-toast';

interface InsightsTabProps {
  transactions: Transaction[];
  loading: boolean;
}

export default function InsightsTab({ transactions, loading }: InsightsTabProps) {
  const { user } = useAuthContext();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);

  // Insights 로드
  useEffect(() => {
    if (user) {
      loadInsights();
    }
  }, [user]);

  const loadInsights = async () => {
    if (!user) return;
    try {
      setLoadingInsights(true);
      const data = await getInsights(user.uid);
      setInsights(data);
      
      // 자동으로 가장 최근 Insight 선택
      if (data.length > 0 && !selectedInsight) {
        setSelectedInsight(data[0]);
      }
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const handleAnalyze = async () => {
    if (!user) return;
    
    setAnalyzing(true);
    setError(null);

    try {
      // 데이터가 있는 월 수 계산
      const monthsWithData = new Set(
        transactions.map((t) => t.date.substring(0, 7))
      ).size;

      // 비교 기간 결정 (3달 이상 데이터가 있으면 3달, 아니면 1달)
      const compareMonths = monthsWithData >= 3 ? 3 : 1;
      const period = compareMonths === 3 ? '3 months' : '1 month';

      // 최근 N달 날짜 범위
      const now = new Date();
      const recentStart = startOfMonth(subMonths(now, compareMonths - 1));
      const recentEnd = endOfMonth(now);
      const recentStartStr = format(recentStart, 'yyyy-MM-dd');
      const recentEndStr = format(recentEnd, 'yyyy-MM-dd');

      // 최근 N달 거래
      const recentTransactions = transactions.filter(
        (t) => t.date >= recentStartStr && t.date <= recentEndStr
      );

      // API 호출
      const response = await fetch('/api/analyze-spending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allTransactions: transactions,
          recentTransactions,
          period,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze spending');
      }

      const data = await response.json();
      
      // Firestore에 저장
      await saveInsight(user.uid, data.analysis, period);
      toast.success('Analysis saved successfully');
      
      // Insights 리스트 새로고침
      const updatedInsights = await getInsights(user.uid);
      setInsights(updatedInsights);
      
      // 가장 최근 것을 자동 선택
      if (updatedInsights.length > 0) {
        setSelectedInsight(updatedInsights[0]);
      }
    } catch (err) {
      console.error('Error analyzing spending:', err);
      setError('Failed to generate analysis. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteInsight = async (insightId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this insight?')) return;

    try {
      await deleteInsight(user.uid, insightId);
      toast.success('Insight deleted');
      setInsights(insights.filter((i) => i.id !== insightId));
      if (selectedInsight?.id === insightId) {
        setSelectedInsight(null);
      }
    } catch (error) {
      console.error('Error deleting insight:', error);
      toast.error('Failed to delete insight');
    }
  };

  if (loading || loadingInsights) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">
            Add some transactions to get personalized spending insights and recommendations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* 왼쪽: Insights 히스토리 리스트 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">💡</span>
              <h2 className="text-2xl font-bold">Insights</h2>
            </div>
            <p className="text-blue-100 text-sm">
              AI-powered spending analysis
            </p>
          </div>

          {/* Generate 버튼 */}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              '+ Generate New Insight'
            )}
          </button>

          {/* Insights 리스트 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">History</h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {insights.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No insights yet. Generate your first analysis!
                </div>
              ) : (
                insights.map((insight) => (
                  <div
                    key={insight.id}
                    onClick={() => setSelectedInsight(insight)}
                    className={`p-4 cursor-pointer transition hover:bg-gray-50 ${
                      selectedInsight?.id === insight.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {format(insight.createdAt, 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {format(insight.createdAt, 'h:mm a')} · {insight.period}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInsight(insight.id);
                        }}
                        className="text-gray-400 hover:text-red-600 transition p-1"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽: 선택된 Insight 내용 */}
        <div className="lg:col-span-2">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {selectedInsight ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              <div className="mb-6 pb-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(selectedInsight.createdAt, 'MMMM dd, yyyy - h:mm a')}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Analysis period: {selectedInsight.period}
                </p>
              </div>

              <div className="prose max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-gray-900 mb-4" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2" {...props} />,
                    p: ({ node, ...props }) => <p className="text-gray-700 mb-4 leading-relaxed" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700" {...props} />,
                    li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                  }}
                >
                  {selectedInsight.analysis}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
              <div className="text-center">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {insights.length === 0 ? 'Generate Your First Insight' : 'Select an Insight'}
                </h3>
                <p className="text-gray-600">
                  {insights.length === 0
                    ? 'Click the button above to get AI-powered spending analysis and recommendations.'
                    : 'Choose an insight from the history to view its details.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
