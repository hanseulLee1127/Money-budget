import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Firebase Admin이 Firestore에 쓸 수 있는지 확인.
 * GET /api/debug/firebase-admin-check → { ok: true } 또는 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const testRef = adminDb.collection('_debug').doc('firebase-admin-check');
    await testRef.set({ ts: Date.now() });
    await testRef.delete();
    return NextResponse.json({
      ok: true,
      hasServiceAccount,
      message: 'Firebase Admin can write to Firestore.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      error: msg,
    });
  }
}
