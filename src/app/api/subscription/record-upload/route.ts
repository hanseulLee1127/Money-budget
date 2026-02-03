import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { recordUpload } from '@/lib/subscription-server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const result = await recordUpload(uid);
    return NextResponse.json({
      success: true,
      data: { allowed: result.allowed, remaining: result.remaining },
    });
  } catch (error) {
    console.error('Record upload error:', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
