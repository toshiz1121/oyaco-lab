/**
 * Firebase Admin SDK 初期化（サーバーサイド専用）
 *
 * Server Action や API Route など Node.js 上で Firestore にアクセスするために使用。
 * 認証は GOOGLE_APPLICATION_CREDENTIALS（サービスアカウントキー）を利用する。
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

  // GOOGLE_APPLICATION_CREDENTIALS が設定されていればデフォルト認証を使用
  // Cloud Run / GCE 上ではメタデータサーバーから自動取得される
  // 環境変数からプロジェクトIDを取得、なければデフォルト値を使用
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                    process.env.FIREBASE_PROJECT_ID || 
                    'kids-kikkake-lab';
  
  _adminApp = initializeApp({
    projectId,
  });

  console.log(`[Firebase Admin] Initialized with projectId: ${projectId}`);
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
