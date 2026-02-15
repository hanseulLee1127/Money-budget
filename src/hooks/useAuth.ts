'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // 세션만 유지: 탭/창 닫으면 로그아웃 (localStorage 대신 sessionStorage)
  useEffect(() => {
    setPersistence(auth, browserSessionPersistence).catch(() => {});
  }, []);

  // 인증 상태 변경 감지
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuth.ts:37',message:'onAuthStateChanged setup',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuth.ts:38',message:'Auth state changed',data:{hasUser:!!user,userEmail:user?.email},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      setState((prev) => ({
        ...prev,
        user,
        loading: false,
      }));
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => unsubscribe();
  }, []);

  // 로그인
  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      throw error;
    }
  };

  // 회원가입
  const signUp = async (email: string, password: string): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      throw error;
    }
  };

  // 로그아웃 (낙관적 업데이트: 즉시 로그아웃 상태로 전환)
  const signOut = async (): Promise<void> => {
    // 즉시 로그아웃 상태로 전환 (UI가 바로 반응)
    setState((prev) => ({ ...prev, user: null, loading: false, error: null }));

    // 백그라운드에서 Firebase 로그아웃 처리 (await 없이)
    firebaseSignOut(auth).catch((error) => {
      console.error('Background sign out error:', error);
      // 에러가 발생해도 이미 UI는 로그아웃 상태이므로 사용자 경험에 영향 없음
    });
  };

  // 비밀번호 재설정 이메일 전송
  const resetPassword = async (email: string): Promise<void> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      await sendPasswordResetEmail(auth, email);
      setState((prev) => ({ ...prev, loading: false }));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      throw error;
    }
  };

  // 에러 초기화
  const clearError = useCallback((): void => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/37d305a8-3c44-4ff8-8053-bac24c843629',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAuth.ts:100',message:'clearError called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // 클라이언트 Idle 타임아웃: 로그인 상태에서 15분 동안 입력/클릭 없으면 signOut
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  useEffect(() => {
    if (!state.user) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        signOutRef.current?.();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [state.user]);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    clearError,
  };
}

// Firebase 에러 메시지를 사용자 친화적인 영어 메시지로 변환
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const errorCode = (error as { code?: string }).code;
    
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }
  return 'An unexpected error occurred.';
}
