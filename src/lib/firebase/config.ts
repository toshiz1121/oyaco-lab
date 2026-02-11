/**
 * Firebase 初期化設定
 * 
 * Firebaseアプリケーションの初期化とインスタンスのエクスポート
 * クライアントサイドでのみ初期化される
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore, connectFirestoreEmulator, memoryLocalCache } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { getFirebaseConfig } from './runtime-config';

// Firebase インスタンスのキャッシュ
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;

// Firebase アプリを初期化（クライアントサイドのみ）
function initializeFirebase() {
  // サーバーサイドでは何もしない
  if (typeof window === 'undefined') {
    return;
  }

  // 既に初期化済みならスキップ
  if (_app) {
    return;
  }

  try {
    // ランタイム設定を取得
    const firebaseConfig = getFirebaseConfig();
    
    console.log('[Firebase] Initializing with config:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'undefined',
      authDomain: firebaseConfig.authDomain || 'undefined',
      projectId: firebaseConfig.projectId || 'undefined',
    });

    // Firebase初期化
    if (getApps().length === 0) {
      _app = initializeApp(firebaseConfig);
      console.log('[Firebase] Initialized successfully');
    } else {
      _app = getApps()[0];
      console.log('[Firebase] Using existing instance');
    }

    // Firestoreを初期化（メモリキャッシュを使用してオフライン問題を回避）
    const firestoreDbName = process.env.NEXT_PUBLIC_FIRESTORE_DB_NAME || '(default)';
    try {
      _db = initializeFirestore(_app, {
        localCache: memoryLocalCache(),
      }, firestoreDbName);
    } catch {
      // HMR等で既に初期化済みの場合はgetFirestoreでフォールバック
      _db = getFirestore(_app, firestoreDbName);
    }
    console.log('[Firebase] Firestore initialized');
    
    // エミュレータ接続の確認（開発環境のみ）
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
      console.log('[Firebase] Connecting to Firestore emulator...');
      connectFirestoreEmulator(_db, 'localhost', 8080);
    }
    
    _storage = getStorage(_app);
    console.log('[Firebase] Storage initialized');
    
    _auth = getAuth(_app);
    console.log('[Firebase] Auth initialized');
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    // 初期化失敗時にキャッシュをリセット
    _app = null;
    _db = null;
    _storage = null;
    _auth = null;
    throw error;
  }
}

// Getter関数でアクセス（遅延初期化）
export function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  initializeFirebase();
  return _app!;
}

export function getFirebaseDb(): Firestore {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  initializeFirebase();
  return _db!;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  initializeFirebase();
  return _storage!;
}

export function getFirebaseAuth(): Auth {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  initializeFirebase();
  return _auth!;
}

// 後方互換性のため、プロパティアクセスで遅延初期化
export const app = new Proxy({} as FirebaseApp, {
  get(_target, prop) {
    return getFirebaseApp()[prop as keyof FirebaseApp];
  }
});

export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    return getFirebaseDb()[prop as keyof Firestore];
  }
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(_target, prop) {
    return getFirebaseStorage()[prop as keyof FirebaseStorage];
  }
});

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return getFirebaseAuth()[prop as keyof Auth];
  }
});
