import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import type { SubscriptionState, SubscriptionPlan } from '@/types';

const SUBSCRIPTION_LIMITS: Record<NonNullable<SubscriptionPlan>, number> = {
  trial: 1,
  basic: 3,
  pro: 10,
};

function subscriptionRef(uid: string) {
  return adminDb.collection('subscriptions').doc(uid);
}

function parseSubscription(data: Record<string, unknown> | undefined): SubscriptionState | null {
  if (!data) return null;
  const toDate = (v: unknown) => (v && typeof (v as { toDate: () => Date }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : undefined);
  return {
    plan: (data.plan as SubscriptionPlan) ?? null,
    stripeCustomerId: data.stripeCustomerId as string | undefined,
    stripeSubscriptionId: data.stripeSubscriptionId as string | undefined,
    currentPeriodEnd: toDate(data.currentPeriodEnd),
    periodStart: toDate(data.periodStart),
    uploadsUsedThisMonth: (data.uploadsUsedThisMonth as number) ?? 0,
    trialUsed: (data.trialUsed as boolean) ?? false,
  };
}

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
 * 서버 전용: PDF 업로드 1회 사용 처리
 */
export async function recordUpload(uid: string): Promise<{ allowed: boolean; remaining: number }> {
  const ref = subscriptionRef(uid);
  const snap = await ref.get();
  const raw = snap.data();
  const current = parseSubscription(raw) ?? {
    plan: null,
    uploadsUsedThisMonth: 0,
    trialUsed: false,
  };
  const state = maybeResetPeriod(current as SubscriptionState);

  if (!state.trialUsed && !state.plan) {
    await ref.set({
      plan: null,
      uploadsUsedThisMonth: 0,
      trialUsed: true,
      updatedAt: Timestamp.now(),
    });
    return { allowed: false, remaining: 0 };
  }

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
      await ref.set({
        plan: state.plan,
        stripeCustomerId: state.stripeCustomerId ?? null,
        stripeSubscriptionId: state.stripeSubscriptionId ?? null,
        currentPeriodEnd: Timestamp.fromDate(periodEnd),
        periodStart: Timestamp.fromDate(periodStart),
        uploadsUsedThisMonth: newUsed,
        trialUsed: state.trialUsed,
        updatedAt: Timestamp.now(),
      });
    } else {
      await ref.update({
        uploadsUsedThisMonth: newUsed,
        updatedAt: Timestamp.now(),
      });
    }
    return { allowed: newUsed < limit, remaining: Math.max(0, limit - newUsed) };
  }

  return { allowed: false, remaining: 0 };
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
  await ref.set({
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
  await ref.update({
    plan: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    periodStart: null,
    updatedAt: Timestamp.now(),
  });
}

/**
 * 서버 전용: 구독 상태 조회 (API용)
 */
export async function getSubscription(uid: string): Promise<SubscriptionState | null> {
  const snap = await subscriptionRef(uid).get();
  return parseSubscription(snap.data() as Record<string, unknown> | undefined);
}

/**
 * 서버 전용: 업로드 가능 여부 및 한도
 */
export function getUploadStatus(state: SubscriptionState | null): { canUpload: boolean; remaining: number; limit: number; plan: SubscriptionPlan } {
  if (!state) {
    return { canUpload: true, remaining: 1, limit: 1, plan: null };
  }
  const reset = maybeResetPeriod(state);
  const limit = reset.plan ? SUBSCRIPTION_LIMITS[reset.plan] : reset.trialUsed ? 0 : 1;
  const used = reset.plan === 'trial' || !reset.plan ? (reset.trialUsed ? 1 : 0) : reset.uploadsUsedThisMonth;
  const remaining = Math.max(0, limit - used);
  return {
    canUpload: remaining > 0,
    remaining,
    limit,
    plan: reset.plan,
  };
}
