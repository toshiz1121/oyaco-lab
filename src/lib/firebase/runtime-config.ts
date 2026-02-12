/**
 * ランタイムFirebase設定
 * 
 * Cloud Runなどのコンテナ環境では、ビルド時に環境変数が埋め込まれない場合があるため、
 * ランタイムで環境変数を取得する仕組みを提供
 */

export function getFirebaseConfig() {
  // クライアントサイドの場合、windowオブジェクトから取得を試みる
  if (typeof window !== 'undefined') {
    // @ts-ignore - グローバル変数として注入される
    if (window.__FIREBASE_CONFIG__) {
      // @ts-ignore
      const config = window.__FIREBASE_CONFIG__;
      console.log('[Firebase Config] Using config from window.__FIREBASE_CONFIG__');
      console.log('[Firebase Config] Firestore DB Name:', config.firestoreDbName || '(default)');
      return config;
    }
  }

  // 環境変数から取得（フォールバック）
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    firestoreDbName: process.env.NEXT_PUBLIC_FIRESTORE_DB_NAME,
  };

  console.log('[Firebase Config] Using config from environment variables');
  console.log('[Firebase Config] Firestore DB Name:', config.firestoreDbName || '(default)');

  // 設定値の検証（firestoreDbNameは任意なので除外）
  const requiredConfig = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };

  const missingKeys = Object.entries(requiredConfig)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    console.error('[Firebase Config] Missing configuration keys:', missingKeys);
    throw new Error(`Firebase configuration is incomplete. Missing: ${missingKeys.join(', ')}`);
  }

  return config;
}
