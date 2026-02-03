'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { useAuthContext } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, error, signIn, clearError } = useAuthContext();

  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // 페이지 이동 시 에러 초기화
  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password);
    router.push('/dashboard');
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
    />
  );
}
