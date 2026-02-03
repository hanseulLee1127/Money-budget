'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { useAuthContext } from '@/components/AuthProvider';
import { createUserProfile } from '@/lib/firestore';

export default function SignUpPage() {
  const router = useRouter();
  const { user, loading, error, signUp, clearError } = useAuthContext();

  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:14',message:'Redirect useEffect triggered',data:{hasUser:!!user,loading},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (user && !loading) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:16',message:'Redirecting to dashboard',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      router.push('/dashboard');
    }
  }, [user, loading, router]);

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
    
    // Firestore에 사용자 프로필 생성
    // 잠시 대기하여 Firebase Auth가 완료되도록 함
    setTimeout(async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:31',message:'setTimeout callback started',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      const currentUser = (await import('@/lib/firebase')).auth.currentUser;
      if (currentUser) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:33',message:'Creating user profile',data:{uid:currentUser.uid,email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        try {
          await createUserProfile(currentUser.uid, email);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:35',message:'User profile created successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:37',message:'createUserProfile failed',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          console.error('Failed to create user profile:', error);
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'signup/page.tsx:36',message:'Redirecting from setTimeout',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      router.push('/dashboard');
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
    />
  );
}
