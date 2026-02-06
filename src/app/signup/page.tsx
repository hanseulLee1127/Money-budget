'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import AuthForm from '@/components/AuthForm';
import { useAuthContext } from '@/components/AuthProvider';
import { createUserProfile } from '@/lib/firestore';

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

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const { user, loading, error, signUp, clearError } = useAuthContext();

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:22',message:'clearError useEffect triggered',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    clearError();
  }, [clearError]);

  const handleSignUp = async (email: string, password: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:26',message:'handleSignUp started',data:{email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    await signUp(email, password);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:27',message:'signUp completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    
    // Firestore에 사용자 프로필 생성 (서버 API로 먼저 보완, 클라이언트는 보조)
    setTimeout(async () => {
      const currentUser = (await import('@/lib/firebase')).auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        try {
          await fetch('/api/user/ensure-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          });
        } catch (e) {
          console.error('Ensure profile failed:', e);
        }
        try {
          await createUserProfile(currentUser.uid, email);
        } catch (error) {
          console.error('Failed to create user profile:', error);
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:36',message:'Redirecting from setTimeout',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      const went = await redirectToCheckoutIfPlan(plan);
      if (!went) router.push('/dashboard');
    }, 500);
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
      mode="signup"
      onSubmit={handleSignUp}
      error={error}
      loading={loading}
      plan={plan}
    />
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}
