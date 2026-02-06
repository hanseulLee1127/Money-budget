'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onSubmit: (email: string, password: string) => Promise<void>;
  error: string | null;
  loading: boolean;
  /** plan=basic|pro: 로그인/회원가입 후 결제 페이지로 이동 */
  plan?: string | null;
}

export default function AuthForm({ mode, onSubmit, error, loading, plan }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // 이메일 유효성 검사
    if (!email || !email.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    // 비밀번호 유효성 검사
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    // 회원가입 시 비밀번호 확인
    if (mode === 'signup' && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    try {
      await onSubmit(email, password);
    } catch {
      // 에러는 상위 컴포넌트에서 처리
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-6 sm:py-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        {/* 로고/타이틀 */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-600 mt-2">
            {mode === 'signin'
              ? 'Sign in to manage your budget'
              : 'Start tracking your expenses'}
          </p>
        </div>

        {/* 에러 메시지 */}
        {displayError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{displayError}</p>
          </div>
        )}

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 이메일 입력 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 min-h-[44px]"
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              {mode === 'signin' && (
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900 min-h-[44px]"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {/* 비밀번호 확인 (회원가입만) */}
          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : mode === 'signin' ? (
              'Sign In'
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        {/* 링크 */}
        <div className="mt-6 text-center space-y-3">
          {mode === 'signin' ? (
            <p className="text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href={plan ? `/signup?plan=${plan}` : '/signup'} className="text-blue-600 hover:text-blue-700 font-medium">
                Sign up
              </Link>
            </p>
          ) : (
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link href={plan ? `/login?plan=${plan}` : '/login'} className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          )}
          
          {/* 홈으로 돌아가기 */}
          <div className="pt-2">
            <Link 
              href="/" 
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
