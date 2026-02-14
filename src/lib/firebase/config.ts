/**
 * Firebase 初期化設定
 * 
 * Firebaseアプリケーションの初期化とインスタンスのエクスポート
 * クライアントサイドでのみ初期化される
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore, memoryLocalCache, enableNetwork } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { getFirebaseConfig } from './runtime-config';

// Firebase インスタンスのキャッシュ
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;
let _initializationPromise: Promise<void> | null = null;

// Firebase アプリを初期化（クライアントサイドのみ）
async function initializeFirebase() {
  // サーバーサイドでは何もしない
  if (typeof window === 'undefined') {
    return;
  }

  // 既に初期化済みならスキップ
  if (_app && _db && _storage && _auth) {
    return;
  }

  // 初期化中の場合は待機
  if (_initializationPromise) {
    await _initializationPromise;
    return;
  }

  // 初期化プロセスを開始
  _initializationPromise = (async () => {
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

      // Firestoreを初期化（オフライン永続化を無効化してCloud Run環境での問題を回避）
      const firestoreDbName = firebaseConfig.firestoreDbName;
      
      const firestoreSettings = {
        localCache: memoryLocalCache(),
        // Cloud Run環境ではオフライン永続化を明示的に無効化
        experimentalForceLongPolling: false,
        experimentalAutoDetectLongPolling: true,
      };
      
      try {
        // データベース名が指定されている場合のみ使用、空文字列の場合はデフォルトを使用
        if (firestoreDbName && firestoreDbName.trim() !== '') {
          console.log('[Firebase] Initializing Firestore with database name:', firestoreDbName);
          _db = initializeFirestore(_app, firestoreSettings, firestoreDbName);
        } else {
          console.log('[Firebase] Initializing Firestore with default database');
          _db = initializeFirestore(_app, firestoreSettings);
        }
        
        // ネットワークを明示的に有効化
        await enableNetwork(_db);
        console.log('[Firebase] Firestore network enabled');
      } catch (error) {
        // HMR等で既に初期化済みの場合はgetFirestoreでフォールバック
        console.warn('[Firebase] Firestore already initialized, using existing instance:', error);
        
        if (firestoreDbName && firestoreDbName.trim() !== '') {
          console.log('[Firebase] Getting existing Firestore instance with database name:', firestoreDbName);
          _db = getFirestore(_app, firestoreDbName);
        } else {
          console.log('[Firebase] Getting existing default Firestore instance');
          _db = getFirestore(_app);
        }
        
        // 既存インスタンスでもネットワークを有効化
        try {
          await enableNetwork(_db);
          console.log('[Firebase] Firestore network enabled (existing instance)');
        } catch (networkError) {
          console.warn('[Firebase] Network already enabled:', networkError);
        }
      }
      console.log('[Firebase] Firestore initialized');
      
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
      _initializationPromise = null;
      throw error;
    }
  })();

  await _initializationPromise;
}

// Getter関数でアクセス（遅延初期化）
export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  await initializeFirebase();
  return _app!;
}

export async function getFirebaseDb(): Promise<Firestore> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  await initializeFirebase();
  return _db!;
}

export async function getFirebaseStorage(): Promise<FirebaseStorage> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  await initializeFirebase();
  return _storage!;
}

export async function getFirebaseAuth(): Promise<Auth> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  await initializeFirebase();
  return _auth!;
}
