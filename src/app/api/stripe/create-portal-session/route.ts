import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminAuth } from '@/lib/firebase-admin';
import { getSubscription } from '@/lib/subscription-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Stripe Customer Portal 세션 생성.
 * 구독 중인 사용자가 결제 정보 변경/구독 취소를 할 수 있는 포털 URL 반환.
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

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const state = await getSubscription(uid);
    const customerId = state?.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json(
        { error: 'No active subscription. You can upgrade from the Pricing page.' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard`,
    });

    return NextResponse.json({
      success: true,
      data: { url: session.url },
    });
  } catch (error) {
    console.error('Create portal session error:', error);
    return NextResponse.json(
      { error: 'Failed to open billing portal' },
      { status: 500 }
    );
  }
}
