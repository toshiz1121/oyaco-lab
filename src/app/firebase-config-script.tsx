/**
 * Firebase設定をクライアントサイドに注入するスクリプト
 * 
 * Next.jsのstandaloneビルドでは環境変数が正しく埋め込まれないことがあるため、
 * サーバーサイドで環境変数を読み取り、HTMLに直接注入する
 * 
 * セキュリティに関する注意:
 * - Firebase API Keyは「識別子」であり、「認証情報」ではありません
 * - 実際のセキュリティはFirebase Security Rulesで制御されます
 * 
 * 参考: https://firebase.google.com/docs/projects/api-keys
 * 
 */

export function FirebaseConfigScript() {
  // サーバーサイドで環境変数を読み取り、クライアントに注入する
  // Cloud Run等のコンテナ環境では NEXT_PUBLIC_ がビルド時に埋め込まれないため、
  // サーバーサイド専用の環境変数（FIREBASE_CLIENT_*）もフォールバックとして参照する
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      || process.env.FIREBASE_CLIENT_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      || process.env.FIREBASE_CLIENT_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      || process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      || process.env.FIREBASE_CLIENT_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
      || process.env.FIREBASE_CLIENT_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
      || process.env.FIREBASE_CLIENT_APP_ID,
    firestoreDbName: process.env.NEXT_PUBLIC_FIRESTORE_DB_NAME
      || process.env.FIRESTORE_DB_NAME,
  };
  

  // 設定値の検証（firestoreDbNameは任意なので除外）
  const requiredConfig = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };
  
  const hasAllKeys = Object.values(requiredConfig).every(v => v !== undefined && v !== '');
  
  if (!hasAllKeys) {
    console.error('[FirebaseConfigScript] Missing Firebase configuration');
  }

  // セキュリティチェック: NEXT_PUBLIC_以外の環境変数が含まれていないことを確認
  // これらは絶対に含めてはいけない
  const dangerousKeys = [
    'GEMINI_API_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'DATABASE_URL',
    'PRIVATE_KEY',
    'SECRET',
  ];
  
  const envKeys = Object.keys(process.env);
  const foundDangerousKeys = dangerousKeys.filter(key => 
    envKeys.some(envKey => envKey.includes(key))
  );
  
  if (foundDangerousKeys.length > 0) {
    console.warn('[FirebaseConfigScript] Dangerous keys detected in environment:', foundDangerousKeys);
  }

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__FIREBASE_CONFIG__ = ${JSON.stringify(config)};`,
      }}
    />
  );
}
