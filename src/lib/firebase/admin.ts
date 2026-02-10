/**
 * Firebase Admin SDK 初期化（サーバーサイド専用）
 *
 * プロジェクト統一構成:
 * - FirebaseとCloud Runが同じGCPプロジェクト (zenn202602) で動作
 * - Application Default Credentials (ADC) を使用
 * - サービスアカウントキー不要
 *
 * クライアント用の firebase/config.ts とは別物。混同しないこと。
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

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                    process.env.FIREBASE_PROJECT_ID || 
                    'zenn202602';

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
  _adminDb = getFirestore(getAdminApp());
  return _adminDb;
}
