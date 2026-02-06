import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Firestore users/{uid} 문서가 없으면 생성.
 * 회원가입 시 클라이언트 Firestore 쓰기가 실패해도 서버에서 보완.
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
    const email = decoded.email ?? '';

    const userRef = adminDb.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      await userRef.set(
        {
          email,
          createdAt: Timestamp.now(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ensure profile error:', error);
    return NextResponse.json({ error: 'Failed to ensure profile' }, { status: 500 });
  }
}
