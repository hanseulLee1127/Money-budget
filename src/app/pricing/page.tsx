'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import toast from 'react-hot-toast';
import { useAuthContext } from '@/components/AuthProvider';

const PRICE_BASIC = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC;
const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Full budget app + one-time AI PDF try',
    features: [
      'Dashboard, charts, calendar',
      'Add & edit transactions manually',
      'Categories & spending by month',
      '1 AI PDF upload (card or statement)',
      'No bank linking',
    ],
    cta: 'Start free',
    href: '/signup',
    planId: null as string | null,
    highlighted: false,
  },
  {
    name: 'Basic',
    price: '$3.99',
    period: '/month',
    description: '3 PDF uploads per month',
    features: [
      'Everything in Free',
      '3 AI PDF uploads per month',
      'Same dashboard & categories',
      'Cancel anytime',
    ],
    cta: 'Subscribe',
    href: '/signup?plan=basic',
    planId: 'basic' as string | null,
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '$6.99',
    period: '/month',
    description: '10 PDF uploads per month',
    features: [
      'Everything in Basic',
      '10 AI PDF uploads per month',
      'Best for multiple cards/accounts',
      'Cancel anytime',
    ],
    cta: 'Subscribe',
    href: '/signup?plan=pro',
    planId: 'pro' as string | null,
    highlighted: false,
  },
];

export default function PricingPage() {
  const { user, loading } = useAuthContext();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const startCheckout = async (planId: string) => {
    const priceId = planId === 'basic' ? PRICE_BASIC : PRICE_PRO;
    if (!priceId) {
      toast.error('Checkout is not configured');
      return;
    }
    setCheckoutLoading(planId);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        toast.error('Please sign in again');
        setCheckoutLoading(null);
        return;
      }
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!data.success || !data.data?.url) {
        toast.error(data.error || 'Failed to start checkout');
        setCheckoutLoading(null);
        return;
      }
      window.location.href = data.data.url;
    } catch {
      toast.error('Failed to start checkout');
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <nav className="container mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-2xl sm:text-3xl font-bold text-blue-600 truncate min-w-0">
            Money Budget
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <Link href="/" className="px-3 py-2 text-sm sm:text-base text-gray-700 hover:text-blue-600 transition">
              Home
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 sm:px-6 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 text-sm sm:text-base text-gray-700 hover:text-blue-600 transition">
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 sm:px-6 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple pricing
          </h1>
          <p className="text-lg text-gray-600">
            Use the app for free. Pay only if you want more AI PDF uploads per month.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border-2 p-6 sm:p-8 flex flex-col ${
                plan.highlighted
                  ? 'border-blue-600 bg-white shadow-xl scale-105 z-10'
                  : 'border-gray-200 bg-white shadow-lg'
              }`}
            >
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
              </div>
              <ul className="space-y-3 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {user && plan.planId ? (
                  <button
                    onClick={() => startCheckout(plan.planId!)}
                    disabled={!!checkoutLoading}
                    className={`block w-full py-3 px-4 text-center font-semibold rounded-xl transition ${
                      plan.highlighted
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {checkoutLoading === plan.planId ? 'Redirecting...' : plan.cta}
                  </button>
                ) : (
                  <Link
                    href={plan.planId ? `${plan.href}` : plan.href}
                    className={`block w-full py-3 px-4 text-center font-semibold rounded-xl transition ${
                      plan.highlighted
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          Free plan includes 1 AI PDF upload (trial). After that, add transactions manually or subscribe for more uploads.
        </p>
      </main>

      <footer className="border-t border-gray-200 py-6 mt-12">
        <div className="container mx-auto px-4 sm:px-6 text-center text-gray-600 text-sm">
          <p>&copy; 2026 Money Budget. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
