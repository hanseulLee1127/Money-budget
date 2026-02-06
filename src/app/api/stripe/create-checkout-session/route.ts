import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminAuth } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email ?? undefined;

    const body = await request.json();
    const { priceId } = body as { priceId: string };
    if (!priceId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?subscription=cancelled`,
      client_reference_id: uid,
      customer_email: email,
      metadata: { uid },
      subscription_data: {
        metadata: { uid },
      },
    });

    return NextResponse.json({
      success: true,
      data: { url: session.url, sessionId: session.id },
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
