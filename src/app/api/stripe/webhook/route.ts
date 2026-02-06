import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { setSubscriptionFromStripe, clearSubscription } from '@/lib/subscription-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const PRICE_BASIC = process.env.STRIPE_PRICE_BASIC || process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC;
const PRICE_PRO = process.env.STRIPE_PRICE_PRO || process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[Stripe webhook] Event received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.metadata?.uid ?? session.client_reference_id;
        if (!uid || typeof uid !== 'string') {
          console.error('[Stripe webhook] No uid in checkout.session.completed', { metadata: session.metadata, client_reference_id: session.client_reference_id });
          break;
        }
        const subscriptionId = session.subscription as string;
        if (!subscriptionId) {
          console.error('[Stripe webhook] No subscription id in session');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId === PRICE_PRO ? 'pro' : priceId === PRICE_BASIC ? 'basic' : null;
        if (!plan) {
          console.error('[Stripe webhook] Unknown price id:', priceId, 'expected BASIC:', PRICE_BASIC, 'PRO:', PRICE_PRO);
          break;
        }
        const periodEndRaw = (subscription as unknown as { current_period_end?: number }).current_period_end;
        const periodEnd = typeof periodEndRaw === 'number' ? periodEndRaw : 0;
        console.log('[Stripe webhook] Setting subscription', { uid, plan, priceId });
        await setSubscriptionFromStripe(uid, {
          plan,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: new Date(periodEnd * 1000),
        });
        console.log('[Stripe webhook] Subscription saved for uid:', uid);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const uid = sub.metadata?.uid;
        if (!uid) break;
        if (sub.status === 'active') {
          const priceId = sub.items.data[0]?.price.id;
          const plan = priceId === PRICE_PRO ? 'pro' : priceId === PRICE_BASIC ? 'basic' : null;
          if (plan) {
            const periodEndRaw = (sub as unknown as { current_period_end?: number }).current_period_end;
            const periodEnd = typeof periodEndRaw === 'number' ? periodEndRaw : 0;
            await setSubscriptionFromStripe(uid, {
              plan,
              stripeCustomerId: sub.customer as string,
              stripeSubscriptionId: sub.id,
              currentPeriodEnd: new Date(periodEnd * 1000),
            });
          }
        } else if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'past_due') {
          await clearSubscription(uid);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const uid = sub.metadata?.uid;
        if (uid) await clearSubscription(uid);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
