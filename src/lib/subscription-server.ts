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
  const currentState = current as SubscriptionState;
  const state = maybeResetPeriod(currentState);

  // 무료(비구독): 트라이얼 1회만 사용 가능
  if (!state.trialUsed && !state.plan) {
    await ref.set({
      plan: null,
      uploadsUsedThisMonth: 0,
      trialUsed: true,
      updatedAt: Timestamp.now(),
    });
    return { allowed: false, remaining: 0 };
  }

  // 구독자이지만 아직 무료 1회를 안 쓴 경우: 무료 1회만 차감, 구독 횟수는 그대로
  if ((state.plan === 'basic' || state.plan === 'pro') && !state.trialUsed) {
    await ref.set({
      plan: state.plan,
      stripeCustomerId: state.stripeCustomerId ?? null,
      stripeSubscriptionId: state.stripeSubscriptionId ?? null,
      currentPeriodEnd: state.currentPeriodEnd ? Timestamp.fromDate(state.currentPeriodEnd) : null,
      periodStart: state.periodStart ? Timestamp.fromDate(state.periodStart) : null,
      uploadsUsedThisMonth: state.uploadsUsedThisMonth,
      trialUsed: true,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    const limit = SUBSCRIPTION_LIMITS[state.plan];
    return { allowed: true, remaining: limit };
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

    // 기간이 끝났으면 새 기간을 Firestore에 반영 (반영 안 하면 다음 읽기마다 메모리에서만 리셋되어 횟수가 안 올라간 것처럼 보임)
    const periodEnded = currentState.currentPeriodEnd && now >= currentState.currentPeriodEnd;
    const firstUploadOfPeriod = state.uploadsUsedThisMonth === 0 && (!state.periodStart || now >= (state.currentPeriodEnd ?? new Date(0)));

    if (periodEnded || firstUploadOfPeriod) {
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
      try {
        await ref.update({
          uploadsUsedThisMonth: newUsed,
          updatedAt: Timestamp.now(),
        });
      } catch (e) {
        // 문서가 없으면(웹훅 지연 등) 새 기간으로 전체 문서 생성
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
      }
    }
    return { allowed: newUsed < limit, remaining: Math.max(0, limit - newUsed) };
  }

  return { allowed: false, remaining: 0 };
}

/**
 * Stripe 웹훅에서 구독 갱신 시 호출
 * trialUsed: false — 구독 후에도 무료 1회를 먼저 쓰고, 그다음 구독 횟수 차감
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
  const existing = (await ref.get()).data() as Record<string, unknown> | undefined;
  const trialUsed = existing?.trialUsed === true;
  await ref.set({
    plan: payload.plan,
    stripeCustomerId: payload.stripeCustomerId,
    stripeSubscriptionId: payload.stripeSubscriptionId,
    currentPeriodEnd: Timestamp.fromDate(payload.currentPeriodEnd),
    periodStart: Timestamp.fromDate(now),
    uploadsUsedThisMonth: 0,
    trialUsed,
    updatedAt: Timestamp.now(),
  });
}

/**
 * 구독 취소/만료 시
 * trialUsed: true — 취소 후 무료 1회를 다시 주지 않음 (PDF 업로드 불가)
 */
export async function clearSubscription(uid: string): Promise<void> {
  const ref = subscriptionRef(uid);
  await ref.set(
    {
      plan: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      periodStart: null,
      uploadsUsedThisMonth: 0,
      trialUsed: true,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
}

/**
 * [한 달 지난 뒤 0으로 리셋되는 로직]
 * 1. maybeResetPeriod: now >= currentPeriodEnd 이면 메모리에서 uploadsUsedThisMonth=0, 새 period 반환.
 * 2. getSubscription: 구독 상태 조회 시 periodEnded 이면 Firestore에 새 기간 + uploadsUsedThisMonth=0 으로 set(merge) 후 반환.
 *    → 업로드 페이지 열 때 /api/subscription/status 호출로 이게 실행되므로, 한 달 지나면 그때 0으로 반영됨.
 * 3. recordUpload: 업로드 기록 시에도 periodEnded 이면 새 기간 + 새 사용 횟수를 Firestore에 반영.
 */

/**
 * 서버 전용: 구독 상태 조회 (API용)
 * 기간이 끝났으면 Firestore에 새 기간·0회로 반영 후 반환 (반영 안 하면 매번 메모리에서만 리셋되어 UI가 틀려짐)
 */
export async function getSubscription(uid: string): Promise<SubscriptionState | null> {
  const ref = subscriptionRef(uid);
  const snap = await ref.get();
  const raw = snap.data() as Record<string, unknown> | undefined;
  const state = parseSubscription(raw) as SubscriptionState | null;
  if (!state) return null;
  const reset = maybeResetPeriod(state);
  const periodEnded = state.currentPeriodEnd && new Date() >= state.currentPeriodEnd;
  if (periodEnded) {
    const now = new Date();
    const newPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    await ref.set({
      plan: reset.plan,
      stripeCustomerId: state.stripeCustomerId ?? null,
      stripeSubscriptionId: state.stripeSubscriptionId ?? null,
      currentPeriodEnd: Timestamp.fromDate(newPeriodEnd),
      periodStart: Timestamp.fromDate(now),
      uploadsUsedThisMonth: 0,
      trialUsed: state.trialUsed,
      updatedAt: Timestamp.now(),
    }, { merge: true });
    return { ...reset, uploadsUsedThisMonth: 0, periodStart: now, currentPeriodEnd: newPeriodEnd };
  }
  return reset;
}

/**
 * 서버 전용: 업로드 가능 여부 및 한도
 * 구독 + 아직 무료 1회 미사용: remaining = limit + 1 (무료 1회 먼저, 그다음 구독 횟수)
 */
export function getUploadStatus(state: SubscriptionState | null): { canUpload: boolean; remaining: number; limit: number; plan: SubscriptionPlan } {
  if (!state) {
    return { canUpload: true, remaining: 1, limit: 1, plan: null };
  }
  const reset = maybeResetPeriod(state);
  const planLimit = reset.plan ? SUBSCRIPTION_LIMITS[reset.plan] : null;
  const limit = planLimit ?? (reset.trialUsed ? 0 : 1);
  let used: number;
  let remaining: number;
  if (reset.plan === 'basic' || reset.plan === 'pro') {
    if (!reset.trialUsed) {
      remaining = planLimit! + 1;
      used = 0;
    } else {
      used = reset.uploadsUsedThisMonth;
      remaining = Math.max(0, planLimit! - used);
    }
  } else {
    used = reset.trialUsed ? 1 : 0;
    remaining = Math.max(0, limit - used);
  }
  return {
    canUpload: remaining > 0,
    remaining,
    limit: planLimit ?? limit,
    plan: reset.plan,
  };
}
