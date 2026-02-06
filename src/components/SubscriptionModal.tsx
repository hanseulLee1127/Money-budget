'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import toast from 'react-hot-toast';
import type { SubscriptionPlan } from '@/types';

interface SubscriptionModalProps {
  onClose: () => void;
}

const PLAN_LABELS: Record<NonNullable<SubscriptionPlan>, string> = {
  trial: 'Free (trial)',
  basic: 'Basic — $3.99/month',
  pro: 'Pro — $6.99/month',
};

export default function SubscriptionModal({ onClose }: SubscriptionModalProps) {
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/subscription/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && data.success && data.data) {
          setPlan(data.data.plan ?? null);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load subscription');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) {
        toast.error('Please sign in again');
        setPortalLoading(false);
        return;
      }
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!data.success || !data.data?.url) {
        toast.error(data.error || 'Failed to open billing portal');
        setPortalLoading(false);
        return;
      }
      window.location.href = data.data.url;
    } catch {
      toast.error('Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  const planLabel = plan ? PLAN_LABELS[plan] ?? plan : 'Free';
  const isPaid = plan === 'basic' || plan === 'pro';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Subscription</h2>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <p className="text-gray-700">
                <span className="font-medium">Current plan:</span>{' '}
                <span className="text-gray-900">{planLabel}</span>
              </p>

              {isPaid ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {portalLoading ? 'Opening...' : 'Manage subscription'}
                </button>
              ) : (
                <Link
                  href="/pricing"
                  onClick={onClose}
                  className="block w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
                >
                  Upgrade plan
                </Link>
              )}

              {isPaid && (
                <p className="text-sm text-gray-500">
                  You can update payment method or cancel your subscription in the billing portal.
                </p>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
