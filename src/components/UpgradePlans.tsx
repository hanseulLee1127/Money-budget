'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import toast from 'react-hot-toast';

interface UpgradePlansProps {
  onClose?: () => void;
}

const PRICE_BASIC = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC;
const PRICE_PRO = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;

export default function UpgradePlans({ onClose }: UpgradePlansProps) {
  const [loading, setLoading] = useState<'basic' | 'pro' | null>(null);

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
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <h4 className="font-semibold text-gray-900 mb-1">Basic — $2.99/month</h4>
          <p className="text-sm text-gray-600 mb-4">3 PDF uploads per month</p>
          <button
            onClick={() => PRICE_BASIC && handleSubscribe(PRICE_BASIC, 'basic')}
            disabled={!PRICE_BASIC || loading !== null}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === 'basic' ? 'Redirecting...' : 'Subscribe'}
          </button>
        </div>
        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <h4 className="font-semibold text-gray-900 mb-1">Pro — $6.99/month</h4>
          <p className="text-sm text-gray-600 mb-4">10 PDF uploads per month</p>
          <button
            onClick={() => PRICE_PRO && handleSubscribe(PRICE_PRO, 'pro')}
            disabled={!PRICE_PRO || loading !== null}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === 'pro' ? 'Redirecting...' : 'Subscribe'}
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
