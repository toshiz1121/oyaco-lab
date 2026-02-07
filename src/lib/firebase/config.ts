/**
 * Firebase 初期化設定
 * 
 * Firebaseアプリケーションの初期化とインスタンスのエクスポート
 * クライアントサイドでのみ初期化される
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
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

    _db = getFirestore(_app);
    _storage = getStorage(_app);
    _auth = getAuth(_app);
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
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
  get(target, prop) {
    return getFirebaseApp()[prop as keyof FirebaseApp];
  }
});

export const db = new Proxy({} as Firestore, {
  get(target, prop) {
    return getFirebaseDb()[prop as keyof Firestore];
  }
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(target, prop) {
    return getFirebaseStorage()[prop as keyof FirebaseStorage];
  }
});

export const auth = new Proxy({} as Auth, {
  get(target, prop) {
    return getFirebaseAuth()[prop as keyof Auth];
  }
});
