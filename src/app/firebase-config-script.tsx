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
  // サーバーサイドで環境変数を読み取る
  // Next.jsのstandaloneモードでは、NEXT_PUBLIC_*環境変数は
  // サーバーサイドでは読み取れないため、通常の環境変数としても設定する
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };
  
  // デバッグ: サーバーサイドで環境変数が読み取れているか確認
  console.log('[FirebaseConfigScript] Server-side env check:', {
    hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('FIREBASE')),
  });

  // 設定値の検証
  const hasAllKeys = Object.values(config).every(v => v !== undefined && v !== '');
  
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
