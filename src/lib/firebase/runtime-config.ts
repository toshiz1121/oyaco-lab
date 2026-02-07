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
      return window.__FIREBASE_CONFIG__;
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
  };

  // 設定値の検証
  const missingKeys = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    console.error('[Firebase Config] Missing configuration keys:', missingKeys);
    throw new Error(`Firebase configuration is incomplete. Missing: ${missingKeys.join(', ')}`);
  }

  return config;
}
