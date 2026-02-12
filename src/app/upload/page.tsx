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
          cache: 'no-store',
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
    toast.success('File extracted successfully!');

    // AI가 거래 추출 + 카테고리 분류
    setStep('categorizing');

    try {
      // CSV 감지: 헤더가 있고 줄이 많으면 chunking
      const lines = text.trim().split('\n');
      const looksLikeCsv = lines.length > 1 && lines[0].includes(',');
      const CHUNK_SIZE = 100;

      let categorizedTransactions: CategorizedTransaction[] = [];

      if (looksLikeCsv && lines.length > CHUNK_SIZE + 1) {
        // CSV이고 100개 넘으면 chunking
        const header = lines[0];
        const dataLines = lines.slice(1);
        const chunks: string[] = [];

        // 100개씩 나누기 (헤더 포함)
        for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
          const chunkLines = dataLines.slice(i, i + CHUNK_SIZE);
          const chunkText = [header, ...chunkLines].join('\n');
          chunks.push(chunkText);
        }

        console.log(`Processing ${dataLines.length} rows in ${chunks.length} chunks of ${CHUNK_SIZE}`);

        // 병렬 처리
        const chunkResults = await Promise.all(
          chunks.map(async (chunkText) => {
            const response = await fetch('/api/categorize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: chunkText }),
            });
            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error || 'Chunk processing failed');
            }
            return result.data as CategorizedTransaction[];
          })
        );

        // 모든 결과 합치기
        categorizedTransactions = chunkResults.flat();

      } else {
        // 작은 파일이거나 PDF → 기존 방식
        const response = await fetch('/api/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        const result = await response.json();

        if (!result.success) {
          toast.error(result.error || 'Failed to extract transactions');
          setStep('upload');
          return;
        }

        categorizedTransactions = result.data;
      }

      if (categorizedTransactions.length === 0) {
        toast.error('No transactions found in the file');
        setStep('upload');
        return;
      }

      // 업로드 1회 사용 처리 (한도 반영용 — 실패해도 리뷰는 진행)
      let token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        await new Promise((r) => setTimeout(r, 300));
        token = await getAuth().currentUser?.getIdToken(true);
      }
      if (token) {
        const recordRes = await fetch('/api/subscription/record-upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!recordRes.ok) {
          const err = await recordRes.json().catch(() => ({}));
          console.error('Record upload failed', recordRes.status, err);
          toast.error(err?.error || 'Upload count could not be updated.');
        }
      }

      setParsedTransactions(categorizedTransactions);
      sessionStorage.setItem('categorizedTransactions', JSON.stringify(categorizedTransactions));

      toast.success(`Found and categorized ${categorizedTransactions.length} transactions!`);

      router.push('/review');

    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process file. Please try again.');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 네비게이션 */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="text-xl sm:text-2xl font-bold text-slate-900 truncate min-w-0 tracking-tight">
              Money Budget
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm sm:text-base text-slate-500 hover:text-slate-700 transition"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="px-3 py-2 sm:px-4 text-sm sm:text-base text-slate-500 hover:text-slate-700 transition whitespace-nowrap"
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
            <h1 className="text-xl sm:text-3xl font-bold text-slate-900 mb-3 sm:mb-4 px-1 tracking-tight">
              Upload Transaction History
            </h1>
            <p className="text-sm sm:text-base text-slate-500 px-1">
              Upload your bank statement PDF or transaction history CSV and we&apos;ll automatically extract and categorize your transactions.
            </p>
          </div>

          {/* 진행 단계 표시 */}
          <div className="flex items-center justify-center mb-8 sm:mb-10 overflow-x-auto">
            <div className="flex items-center">
              {/* 단계 1: 업로드 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                  step === 'upload' ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {step === 'upload' ? '1' : '✓'}
                </div>
                <span className="ml-2 text-sm font-medium text-slate-600">Upload</span>
              </div>

              {/* 연결선 */}
              <div className={`w-16 h-0.5 mx-4 ${
                step !== 'upload' ? 'bg-blue-600' : 'bg-slate-200'
              }`}></div>

              {/* 단계 2: 카테고리 분류 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                  step === 'categorizing' ? 'bg-blue-600 text-white' :
                  step === 'upload' ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium text-slate-600">Categorize</span>
              </div>

              {/* 연결선 */}
              <div className="w-16 h-0.5 mx-4 bg-slate-200"></div>

              {/* 단계 3: 확인 */}
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 text-slate-400 font-medium">
                  3
                </div>
                <span className="ml-2 text-sm font-medium text-slate-600">Review</span>
              </div>
            </div>
          </div>

          {/* 업로드 불가 시 */}
          {step === 'upload' && subscription && !subscription.canUpload && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
              {(subscription.plan === 'pro' || subscription.limit === 10) ? (
                <>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">You&apos;ve used all 10 uploads this period</h3>
                  <p className="text-slate-500 mb-6">
                    Please wait for next month. Your upload limit will reset at the start of your billing cycle.
                  </p>
                  <div className="text-center">
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="px-6 py-2 text-slate-600 hover:text-slate-900 transition"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </>
              ) : subscription.plan === 'basic' ? (
                <>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">You&apos;ve used all 3 uploads on your Basic plan</h3>
                  <p className="text-slate-500 mb-6">
                    Upgrade to Pro for 10 uploads per month and upload more transaction history this period.
                  </p>
                  <UpgradePlans onClose={() => router.push('/dashboard')} upgradeFromPlan="basic" />
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Upload limit reached</h3>
                  <p className="text-slate-500 mb-6">
                    Subscribe to upload more transaction files. Free trial: 1 upload. Plans: $1.99/month (3 uploads) or $3.99/month (10 uploads) - Limited time sale!
                  </p>
                  <UpgradePlans onClose={() => router.push('/dashboard')} />
                </>
              )}
            </div>
          )}

          {/* 업로드 영역 */}
          {step === 'upload' && subscription?.canUpload && (
            <div>
              {subscription.remaining < subscription.limit && (
                <p className="text-sm text-slate-500 mb-4 text-center">
                  Uploads left this period: {subscription.remaining} of {subscription.limit}
                </p>
              )}
              <PdfUpload onUploadComplete={handleUploadComplete} onError={handleError} />

              <div className="mt-6 text-center">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2 text-slate-500 hover:text-slate-700 transition"
                >
                  Cancel and go back to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* 카테고리 분류 중 */}
          {step === 'categorizing' && (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
              <div className="animate-spin rounded-full h-14 w-14 border-2 border-slate-200 border-t-blue-600 mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                AI is Extracting & Categorizing
              </h3>
              <p className="text-slate-500">
                Analyzing your transaction history...
              </p>
              <p className="text-sm text-slate-400 mt-4">
                This may take 10 seconds up to a few minutes.
              </p>
            </div>
          )}

          {/* 보안 안내 */}
          <div className="mt-8 p-4 bg-blue-50/60 rounded-xl border border-blue-100">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-800 text-sm">Your Data is Secure</h4>
                <p className="text-sm text-blue-600 mt-1">
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
