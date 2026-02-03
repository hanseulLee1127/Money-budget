import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getSubscription, getUploadStatus } from '@/lib/subscription-server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const state = await getSubscription(uid);
    const status = getUploadStatus(state);
    return NextResponse.json({
      success: true,
      data: {
        canUpload: status.canUpload,
        remaining: status.remaining,
        limit: status.limit,
        plan: status.plan,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
