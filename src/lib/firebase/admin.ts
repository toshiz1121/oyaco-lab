/**
 * Firebase Admin SDK 初期化（サーバーサイド専用）
 */

import { initializeApp, getApps, type App } from 'firebase-admin/app';
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

  const projectId = process.env.FIREBASE_PROJECT_ID || 'zenn202602';

  if (!process.env.FIREBASE_PROJECT_ID) {
    console.warn('[Firebase Admin] FIREBASE_PROJECT_ID is not set, using default: zenn202602');
  }

  try {
    // Application Default Credentials (ADC) を使用
    // Cloud Run環境では自動的に認証される
    _adminApp = initializeApp({
      projectId,
    });
    
    console.log(`[Firebase Admin] Initialized with projectId: ${projectId} (ADC)`);
    
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
    throw new Error('Firebase Admin SDK initialization failed.');
  }

  return _adminApp;
}

/**
 * サーバーサイド用の Firestore インスタンスを取得
 */
export function getAdminDb(): Firestore {
  if (_adminDb) return _adminDb;
  const dbName = process.env.FIRESTORE_DB_NAME || 'oyaco-lab';
  if (!process.env.FIRESTORE_DB_NAME) {
    console.warn('[Firebase Admin] FIRESTORE_DB_NAME is not set, using default: oyaco-lab');
  }
  _adminDb = getFirestore(getAdminApp(), dbName);
  return _adminDb;
}
