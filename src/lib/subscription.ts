import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { SubscriptionState, SubscriptionPlan } from '@/types';

const SUBSCRIPTION_LIMITS: Record<NonNullable<SubscriptionPlan>, number> = {
  trial: 1,
  basic: 3,
  pro: 10,
};

function subscriptionRef(uid: string) {
  return doc(db, 'subscriptions', uid);
}

function parseSubscription(data: Record<string, unknown> | undefined): SubscriptionState | null {
  if (!data) return null;
  return {
    plan: (data.plan as SubscriptionPlan) ?? null,
    stripeCustomerId: data.stripeCustomerId as string | undefined,
    stripeSubscriptionId: data.stripeSubscriptionId as string | undefined,
    currentPeriodEnd: data.currentPeriodEnd ? (data.currentPeriodEnd as Timestamp).toDate() : undefined,
    periodStart: data.periodStart ? (data.periodStart as Timestamp).toDate() : undefined,
    uploadsUsedThisMonth: (data.uploadsUsedThisMonth as number) ?? 0,
    trialUsed: (data.trialUsed as boolean) ?? false,
  };
}

/**
 * 구독 상태 조회
 */
export async function getSubscription(uid: string): Promise<SubscriptionState | null> {
  const snap = await getDoc(subscriptionRef(uid));
  return parseSubscription(snap.data());
}

/**
 * 월 단위 리셋 필요 여부 및 리셋된 상태 반환
 */
function maybeResetPeriod(state: SubscriptionState): SubscriptionState {
  if (!state.currentPeriodEnd || !state.periodStart) return state;
  const now = new Date();
  if (now < state.currentPeriodEnd) return state;
  return {
    ...state,
    periodStart: now,
    currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
    uploadsUsedThisMonth: 0,
  };
}

/**
 * 업로드 가능 여부 및 남은 횟수
 */
export function getUploadLimit(plan: SubscriptionPlan): number {
  if (!plan) return 0;
  return SUBSCRIPTION_LIMITS[plan] ?? 0;
}

export function canUpload(state: SubscriptionState | null): { allowed: boolean; remaining: number; limit: number } {
  if (!state) {
    return { allowed: true, remaining: 1, limit: 1 };
  }
  const reset = maybeResetPeriod(state);
  const limit = reset.plan ? SUBSCRIPTION_LIMITS[reset.plan] : reset.trialUsed ? 0 : 1;
  const used = reset.plan === 'trial' || !reset.plan ? (reset.trialUsed ? 1 : 0) : reset.uploadsUsedThisMonth;
  const remaining = Math.max(0, limit - used);
  return {
    allowed: remaining > 0,
    remaining,
    limit,
  };
}

/**
 * PDF 업로드 1회 사용 처리 (성공한 업로드 후 호출)
 */
export async function recordUpload(uid: string): Promise<{ allowed: boolean; remaining: number }> {
  const ref = subscriptionRef(uid);
  const snap = await getDoc(ref);
  const raw = snap.data();
  const current = parseSubscription(raw) ?? {
    plan: null,
    uploadsUsedThisMonth: 0,
    trialUsed: false,
  };
  const state = maybeResetPeriod(current as SubscriptionState);

  // 트라이얼 1회 사용
  if (!state.trialUsed && !state.plan) {
    await setDoc(ref, {
      plan: null,
      uploadsUsedThisMonth: 0,
      trialUsed: true,
      updatedAt: Timestamp.now(),
    });
    return { allowed: false, remaining: 0 };
  }

  // basic / pro: 기간 리셋 후 1 증가
  if (state.plan === 'basic' || state.plan === 'pro') {
    const newUsed = state.uploadsUsedThisMonth + 1;
    const limit = SUBSCRIPTION_LIMITS[state.plan];
    const now = new Date();
    const periodEnd = state.currentPeriodEnd && now < state.currentPeriodEnd
      ? state.currentPeriodEnd
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const periodStart = state.periodStart && state.currentPeriodEnd && now < state.currentPeriodEnd
      ? state.periodStart
      : now;

    if (state.uploadsUsedThisMonth === 0 && (!state.periodStart || now >= (state.currentPeriodEnd ?? new Date(0)))) {
      await setDoc(ref, {
        plan: state.plan,
        stripeCustomerId: state.stripeCustomerId,
        stripeSubscriptionId: state.stripeSubscriptionId,
        currentPeriodEnd: Timestamp.fromDate(periodEnd),
        periodStart: Timestamp.fromDate(periodStart),
        uploadsUsedThisMonth: newUsed,
        trialUsed: state.trialUsed,
        updatedAt: Timestamp.now(),
      });
    } else {
      await updateDoc(ref, {
        uploadsUsedThisMonth: newUsed,
        updatedAt: Timestamp.now(),
      });
    }
    return { allowed: newUsed < limit, remaining: Math.max(0, limit - newUsed) };
  }

  return { allowed: false, remaining: 0 };
}

/**
 * 구독 문서 초기 생성 (트라이얼 사용자)
 */
export async function ensureSubscriptionDoc(uid: string): Promise<SubscriptionState> {
  const ref = subscriptionRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return parseSubscription(snap.data()) as SubscriptionState;
  }
  const initial = {
    plan: null as SubscriptionPlan,
    uploadsUsedThisMonth: 0,
    trialUsed: false,
    updatedAt: Timestamp.now(),
  };
  await setDoc(ref, initial);
  return { ...initial, currentPeriodEnd: undefined, periodStart: undefined };
}

/**
 * Stripe 웹훅에서 구독 갱신 시 호출
 */
export async function setSubscriptionFromStripe(
  uid: string,
  payload: {
    plan: 'basic' | 'pro';
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEnd: Date;
  }
): Promise<void> {
  const ref = subscriptionRef(uid);
  const now = new Date();
  await setDoc(ref, {
    plan: payload.plan,
    stripeCustomerId: payload.stripeCustomerId,
    stripeSubscriptionId: payload.stripeSubscriptionId,
    currentPeriodEnd: Timestamp.fromDate(payload.currentPeriodEnd),
    periodStart: Timestamp.fromDate(now),
    uploadsUsedThisMonth: 0,
    trialUsed: true,
    updatedAt: Timestamp.now(),
  });
}

/**
 * 구독 취소/만료 시
 */
export async function clearSubscription(uid: string): Promise<void> {
  const ref = subscriptionRef(uid);
  await updateDoc(ref, {
    plan: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    periodStart: null,
    updatedAt: Timestamp.now(),
  });
}
