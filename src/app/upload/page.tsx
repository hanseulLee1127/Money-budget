'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuthContext } from '@/components/AuthProvider';
import PdfUpload from '@/components/PdfUpload';
import UpgradePlans from '@/components/UpgradePlans';
import { ParsedTransaction, CategorizedTransaction } from '@/types';
import { getAuth } from 'firebase/auth';

type SubscriptionStatus = {
  canUpload: boolean;
  remaining: number;
  limit: number;
  plan: string | null;
};

export default function UploadPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuthContext();
  const [step, setStep] = useState<'upload' | 'processing' | 'categorizing'>('upload');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // 인증 체크 (비로그인 시 랜딩 페이지로)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // 구독 상태 조회
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getAuth().currentUser?.getIdToken();
        if (!token || cancelled) return;
        const res = await fetch('/api/subscription/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json.success && json.data) setSubscription(json.data);
      } catch {
        setSubscription({ canUpload: true, remaining: 1, limit: 1, plan: null });
      } finally {
        if (!cancelled) setSubscriptionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleUploadComplete = async (text: string) => {
    toast.success('PDF extracted successfully!');
    
    // AI가 거래 추출 + 카테고리 분류
    setStep('categorizing');
    
    try {
      const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error || 'Failed to extract transactions');
        setStep('upload');
        return;
      }

      // AI가 추출하고 분류한 거래 내역
      const categorizedTransactions: CategorizedTransaction[] = result.data;
      
      if (categorizedTransactions.length === 0) {
        toast.error('No transactions found in the PDF');
        setStep('upload');
        return;
      }
      
      // 업로드 1회 사용 처리
      const token = await getAuth().currentUser?.getIdToken();
      if (token) {
        await fetch('/api/subscription/record-upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      setParsedTransactions(categorizedTransactions);
      sessionStorage.setItem('categorizedTransactions', JSON.stringify(categorizedTransactions));
      
      toast.success(`Found and categorized ${categorizedTransactions.length} transactions!`);
      
      router.push('/review');
      
    } catch {
      toast.error('Failed to process PDF. Please try again.');
      setStep('upload');
    }
  };

  const handleError = (error: string) => {
    toast.error(error);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (authLoading || !user || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="text-lg sm:text-2xl font-bold text-blue-600 truncate min-w-0">
              Money Budget
            </Link>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-800 transition"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-600 hover:text-gray-800 transition whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 px-1">
              Upload Bank Statement or Card History
            </h1>
            <p className="text-sm sm:text-base text-gray-600 px-1">
              Upload your bank statement or credit card / debit card transaction history PDF and we&apos;ll automatically extract and categorize your transactions.
            </p>
          </div>

          {/* 진행 단계 표시 */}
          <div className="flex items-center justify-center mb-8 sm:mb-10 overflow-x-auto">
            <div className="flex items-center">
              {/* 단계 1: 업로드 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step === 'upload' ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'
                }`}>
                  {step === 'upload' ? '1' : '✓'}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">Upload</span>
              </div>

              {/* 연결선 */}
              <div className={`w-16 h-1 mx-4 ${
                step !== 'upload' ? 'bg-blue-600' : 'bg-gray-200'
              }`}></div>

              {/* 단계 2: 카테고리 분류 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step === 'categorizing' ? 'bg-blue-600 text-white' : 
                  step === 'upload' ? 'bg-gray-200 text-gray-500' : 'bg-green-500 text-white'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">Categorize</span>
              </div>

              {/* 연결선 */}
              <div className="w-16 h-1 mx-4 bg-gray-200"></div>

              {/* 단계 3: 확인 */}
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-200 text-gray-500">
                  3
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">Review</span>
              </div>
            </div>
          </div>

          {/* 업로드 불가 시 구독 유도 */}
          {step === 'upload' && subscription && !subscription.canUpload && (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">PDF upload limit reached</h3>
              <p className="text-gray-600 mb-6">
                Subscribe to upload more PDFs (bank statement or credit card / debit card transaction history). Free trial: 1 upload. Plans: $2.99/month (3 uploads) or $6.99/month (10 uploads).
              </p>
              <UpgradePlans onClose={() => router.push('/dashboard')} />
            </div>
          )}

          {/* 업로드 영역 */}
          {step === 'upload' && subscription?.canUpload && (
            <div>
              {subscription.remaining < subscription.limit && (
                <p className="text-sm text-gray-600 mb-4 text-center">
                  Uploads left this period: {subscription.remaining} of {subscription.limit}
                </p>
              )}
              <PdfUpload onUploadComplete={handleUploadComplete} onError={handleError} />
              
              <div className="mt-6 text-center">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 transition"
                >
                  Cancel and go back to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* 카테고리 분류 중 */}
          {step === 'categorizing' && (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600 mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                AI is Extracting & Categorizing
              </h3>
              <p className="text-gray-500">
                Analyzing your bank statement or card transaction history...
              </p>
              <p className="text-sm text-gray-400 mt-4">
                This may take 10 seconds up to a few minutes.
              </p>
            </div>
          )}

          {/* 보안 안내 */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-800">Your Data is Secure</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Personal information (account numbers, addresses, phone numbers) is automatically removed before processing. 
                  Your transaction data is encrypted before storage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
