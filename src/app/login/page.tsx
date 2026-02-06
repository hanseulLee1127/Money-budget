'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import AuthForm from '@/components/AuthForm';
import { useAuthContext } from '@/components/AuthProvider';

const PRICE_BASIC = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC;
const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;

async function redirectToCheckoutIfPlan(plan: string | null): Promise<boolean> {
  if (plan !== 'basic' && plan !== 'pro') return false;
  const priceId = plan === 'basic' ? PRICE_BASIC : PRICE_PRO;
  if (!priceId) return false;
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) return false;
  const res = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ priceId }),
  });
  const data = await res.json();
  if (data.success && data.data?.url) {
    window.location.href = data.data.url;
    return true;
  }
  return false;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const { user, loading, error, signIn, clearError } = useAuthContext();

  // 이미 로그인된 경우: plan 있으면 결제 페이지로, 없으면 대시보드
  useEffect(() => {
    if (!user || loading) return;
    (async () => {
      const went = await redirectToCheckoutIfPlan(plan);
      if (!went) router.push('/dashboard');
    })();
  }, [user, loading, plan, router]);

  // 페이지 이동 시 에러 초기화
  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    const went = await redirectToCheckoutIfPlan(plan);
    if (!went) router.push('/dashboard');
  };

  // 로딩 중이거나 이미 로그인된 경우 로딩 표시
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AuthForm
      mode="signin"
      onSubmit={handleSignIn}
      error={error}
      loading={loading}
      plan={plan}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
