import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminAuth } from '@/lib/firebase-admin';
import { setSubscriptionFromStripe } from '@/lib/subscription-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const PRICE_BASIC = process.env.STRIPE_PRICE_BASIC || process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC;
const PRICE_PRO = process.env.STRIPE_PRICE_PRO || process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;

/**
 * 결제 성공 후 대시보드 진입 시 호출.
 * 웹훅이 실패했을 때를 대비해 Stripe 세션으로 구독 정보를 가져와 Firestore에 저장.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await request.json();
    const sessionId = (body?.session_id ?? body?.sessionId) as string | undefined;
    if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    const sessionUid = (session.metadata?.uid ?? session.client_reference_id) as string | undefined;
    if (!sessionUid || sessionUid !== uid) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
    }

    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      return NextResponse.json({ error: 'No subscription in session' }, { status: 400 });
    }

    const subscription =
      typeof session.subscription === 'object' && session.subscription !== null
        ? (session.subscription as Stripe.Subscription)
        : await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId === PRICE_PRO ? 'pro' : priceId === PRICE_BASIC ? 'basic' : null;
    if (!plan) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
    }

    const periodEndRaw = (subscription as unknown as { current_period_end?: number }).current_period_end;
    const periodEnd = typeof periodEndRaw === 'number' ? periodEndRaw : 0;

    await setSubscriptionFromStripe(uid, {
      plan,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(periodEnd * 1000),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Confirm subscription error:', error);
    return NextResponse.json({ error: 'Failed to confirm subscription' }, { status: 500 });
  }
}
