import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0] as ReturnType<typeof initializeApp>;
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const serviceAccount = JSON.parse(json) as ServiceAccount;
      return initializeApp({ credential: cert(serviceAccount) });
    } catch {
      // fallback for build when env not available
    }
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    return initializeApp({ projectId });
  }
  return initializeApp({ projectId: 'money-budget-placeholder' });
}

const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
