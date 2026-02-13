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
  // ハードコードされた設定値（Cloud Consoleデプロイ用の一時的な解決策）
  const hardcodedConfig = {
    apiKey: "AIzaSyBGmMNP2qT9Hjn5NclTL0GMdzCJOLTRLdw",
    authDomain: "zenn202602.firebaseapp.com",
    projectId: "zenn202602",
    storageBucket: "zenn202602.firebasestorage.app",
    messagingSenderId: "572758467709",
    appId: "1:572758467709:web:dbbad2ad786a8cc19e3d14",
    firestoreDbName: "", // デフォルトデータベースを使用する場合は空文字列
  };
  
  // 環境変数があればそれを使用、なければハードコード値を使用
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || hardcodedConfig.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || hardcodedConfig.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || hardcodedConfig.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || hardcodedConfig.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || hardcodedConfig.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || hardcodedConfig.appId,
    firestoreDbName: process.env.NEXT_PUBLIC_FIRESTORE_DB_NAME || hardcodedConfig.firestoreDbName,
  };
  
  console.log('[FirebaseConfigScript] Config source:', 
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'environment' : 'hardcoded'
  );

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
