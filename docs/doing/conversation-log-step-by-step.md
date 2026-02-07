# 会話ログFirebase実装 - Step by Step手順書

## 📋 概要

この手順書に従って、1ステップずつ実装を進めてください。
各ステップは独立しており、動作確認しながら進められます。

---

## 🎯 全体の流れ

```
Step 1: 環境準備（Firebase設定）
  ↓
Step 2: 基盤ファイル作成
  ↓
Step 3: 接続テスト
  ↓
Step 4: ログ機能実装
  ↓
Step 5: 既存コードへの統合
  ↓
Step 6: 動作確認
  ↓
Step 7: 親向けダッシュボード（オプション）
```

---

## Step 1: Firebase プロジェクト設定

### 1-1. Firebase プロジェクト作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `kids-science-lab`）
4. Google Analyticsは任意（後で追加可能）
5. プロジェクト作成完了を待つ

### 1-2. Firestore データベース作成

1. 左メニューから「Firestore Database」を選択
2. 「データベースの作成」をクリック
3. **本番環境モード**を選択（後でルールを設定）
4. ロケーションを選択（推奨: `asia-northeast1` - 東京）
5. 「有効にする」をクリック

### 1-3. Cloud Storage 有効化

1. 左メニューから「Storage」を選択
2. 「始める」をクリック
3. セキュリティルールは「本番環境モード」を選択
4. ロケーションは Firestore と同じものを選択
5. 「完了」をクリック

### 1-4. Web アプリを追加

1. プロジェクト概要ページで「</>」（Web）アイコンをクリック
2. アプリのニックネームを入力（例: `kids-science-web`）
3. Firebase Hosting は不要（チェックなし）
4. 「アプリを登録」をクリック
5. **表示される設定情報をコピー**（次のステップで使用）

```javascript
// この情報をコピーしておく
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 1-5. セキュリティルール設定

#### Firestore ルール
1. Firestore Database → 「ルール」タブ
2. 以下のルールを貼り付け

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 開発中は全て許可（後で厳格化）
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. 「公開」をクリック

#### Storage ルール
1. Storage → 「ルール」タブ
2. 以下のルールを貼り付け

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 開発中は全て許可
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

3. 「公開」をクリック

**⚠️ 注意**: 本番環境では必ず認証ベースのルールに変更してください

---

## Step 2: パッケージインストール

### 2-1. Firebase SDK インストール

```bash
npm install firebase
```

### 2-2. インストール確認

```bash
npm list firebase
```

出力例:
```
kids-science-lab@0.11.0
└── firebase@11.1.0
```

---

## Step 3: 環境変数設定

### 3-1. `.env.local` ファイル作成

プロジェクトルートに `.env.local` を作成（既存の場合は追記）

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# デフォルトの子供ID（開発用）
NEXT_PUBLIC_DEFAULT_CHILD_ID=child1
```

**Step 1-4でコピーした値を貼り付けてください**

### 3-2. `.env.example` に追記

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_DEFAULT_CHILD_ID=child1
```

### 3-3. `.gitignore` 確認

`.env.local` が無視されていることを確認

```bash
grep ".env.local" .gitignore
```

なければ追加:
```bash
echo ".env.local" >> .gitignore
```

---

## Step 4: 基盤ファイル作成

### 4-1. ディレクトリ作成

```bash
mkdir -p src/lib/firebase
```

### 4-2. 型定義ファイル作成

**ファイル**: `src/lib/firebase/types.ts`

このファイルを作成してください（内容は後述）

### 4-3. Firebase設定ファイル作成

**ファイル**: `src/lib/firebase/config.ts`

このファイルを作成してください（内容は後述）

### 4-4. Firestore操作ファイル作成

**ファイル**: `src/lib/firebase/firestore.ts`

このファイルを作成してください（内容は後述）

### 4-5. 会話ログ管理ファイル作成

**ファイル**: `src/lib/conversation-logger.ts`

このファイルを作成してください（内容は後述）

---

## Step 5: 接続テスト

### 5-1. テストページ作成

**ファイル**: `src/app/test-firebase/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default function TestFirebasePage() {
  const [status, setStatus] = useState('接続テスト中...');
  const [testData, setTestData] = useState<any[]>([]);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      // テストデータを書き込み
      const testRef = collection(db, 'test');
      const docRef = await addDoc(testRef, {
        message: 'Hello Firebase!',
        timestamp: new Date(),
      });

      setStatus(`✅ 接続成功！ドキュメントID: ${docRef.id}`);

      // データを読み込み
      const snapshot = await getDocs(testRef);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTestData(data);

    } catch (error) {
      setStatus(`❌ エラー: ${error}`);
      console.error('Firebase接続エラー:', error);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Firebase 接続テスト</h1>
      <p className="mb-4">{status}</p>
      
      {testData.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-2">取得データ:</h2>
          <pre className="bg-gray-100 p-4 rounded">
            {JSON.stringify(testData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

### 5-2. テスト実行

1. 開発サーバー起動
```bash
npm run dev
```

2. ブラウザで `http://localhost:3000/test-firebase` にアクセス

3. 「✅ 接続成功！」が表示されればOK

4. Firebase Console → Fi