/**
 * Firebase Admin SDK 初期化（サーバーサイド専用）
 *
 * Cloud Run環境:
 * - FIREBASE_SERVICE_ACCOUNT_JSON: Secret Managerから環境変数としてマウント（推奨）
 * - FIREBASE_SERVICE_ACCOUNT_BASE64: Base64エンコードされたサービスアカウント
 *
 * クライアント用の firebase/config.ts とは別物。混同しないこと。
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let _adminApp: App | null = null;
let _adminDb: Firestore | null = null;

/**
 * Admin SDK のアプリインスタンスを取得（遅延初期化・シングルトン）
 */
function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  if (getApps().length > 0) {
    _adminApp = getApps()[0];
    return _adminApp;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                    process.env.FIREBASE_PROJECT_ID || 
                    'kids-kikkake-lab';

  try {
    // Cloud Run - JSON文字列として直接設定（Secret Manager経由、推奨）
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      _adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
      console.log(`[Firebase Admin] Initialized with JSON service account`);
      return _adminApp;
    }

    // フォールバック: 同一プロジェクトの場合のみ動作
    console.warn('[Firebase Admin] No service account configured. Using default credentials (same project only)');
    _adminApp = initializeApp({ projectId });
    
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
    throw new Error('Firebase Admin SDK initialization failed. Please check service account configuration.');
  }

  return _adminApp;
}

/**
 * サーバーサイド用の Firestore インスタンスを取得
 */
export function getAdminDb(): Firestore {
  if (_adminDb) return _adminDb;
  _adminDb = getFirestore(getAdminApp());
  return _adminDb;
}
