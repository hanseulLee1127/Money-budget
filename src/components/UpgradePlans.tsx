'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import toast from 'react-hot-toast';

interface UpgradePlansProps {
  onClose?: () => void;
  /** Basic 사용자가 한도 소진 시 Pro만 표시 */
  upgradeFromPlan?: 'basic' | null;
}

const PRICE_BASIC = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC;
const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;

export default function UpgradePlans({ onClose, upgradeFromPlan }: UpgradePlansProps) {
  const [loading, setLoading] = useState<'basic' | 'pro' | null>(null);
  const showOnlyPro = upgradeFromPlan === 'basic';

  const handleSubscribe = async (priceId: string, plan: 'basic' | 'pro') => {
    if (!priceId) {
      toast.error('Stripe price not configured');
      return;
    }
    setLoading(plan);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        toast.error('Please sign in again');
        setLoading(null);
        return;
      }
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!data.success || !data.data?.url) {
        toast.error(data.error || 'Failed to start checkout');
        setLoading(null);
        return;
      }
      window.location.href = data.data.url;
    } catch {
      toast.error('Failed to start checkout');
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className={showOnlyPro ? '' : 'grid sm:grid-cols-2 gap-4'}>
        {!showOnlyPro && (
          <div className="border-2 border-blue-500 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-white relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              SALE
            </div>
            <h4 className="font-semibold text-gray-900 mb-2">Basic Plan</h4>
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl font-bold text-blue-600">$1.99<span className="text-sm font-normal text-gray-600">/month</span></span>
                <span className="text-lg text-gray-400 line-through">$3.99</span>
              </div>
              <p className="text-xs text-green-600 font-semibold">50% OFF - Limited Time!</p>
            </div>
            <p className="text-sm text-gray-600 mb-4">3 PDF uploads per month</p>
            <button
              onClick={() => PRICE_BASIC && handleSubscribe(PRICE_BASIC, 'basic')}
              disabled={!PRICE_BASIC || loading !== null}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
            >
              {loading === 'basic' ? 'Redirecting...' : 'Subscribe Now'}
            </button>
          </div>
        )}
        <div className="border-2 border-purple-500 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-white relative overflow-hidden">
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            SALE
          </div>
          <h4 className="font-semibold text-gray-900 mb-2">Pro Plan</h4>
          <div className="mb-3">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl font-bold text-purple-600">$3.99<span className="text-sm font-normal text-gray-600">/month</span></span>
              <span className="text-lg text-gray-400 line-through">$6.99</span>
            </div>
            <p className="text-xs text-green-600 font-semibold">43% OFF - Limited Time!</p>
          </div>
          <p className="text-sm text-gray-600 mb-4">10 PDF uploads per month</p>
          <button
            onClick={() => PRICE_PRO && handleSubscribe(PRICE_PRO, 'pro')}
            disabled={!PRICE_PRO || loading !== null}
            className="w-full py-2.5 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition shadow-md"
          >
            {loading === 'pro' ? 'Redirecting...' : showOnlyPro ? 'Upgrade to Pro' : 'Subscribe Now'}
          </button>
        </div>
      </div>
      {onClose && (
        <div className="text-center">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
