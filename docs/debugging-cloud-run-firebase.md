# Cloud Run Firebase エラーのデバッグ手順

## ブラウザコンソールで確認すべきログ

### 1. Firebase初期化ログを探す

ブラウザの開発者ツール（F12）を開いて、以下のログを確認：

#### ✅ 正常な場合

```
[Firebase] Initializing with config: {
  apiKey: "AIzaSyBxxx...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id"
}
[Firebase] Initialized successfully
```

#### ❌ 環境変数が埋め込まれていない場合

```
[Firebase] Initializing with config: {
  apiKey: "undefined",
  authDomain: "undefined",
  projectId: "undefined"
}
FirebaseError: Firebase: Error (auth/invalid-api-key)
```

### 2. window.__FIREBASE_CONFIG__ を確認

コンソールで以下を実行：

```javascript
console.log(window.__FIREBASE_CONFIG__);
```

#### ✅ 正常な場合

```javascript
{
  apiKey: "AIzaSyBxxx...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

#### ❌ 問題がある場合

```javascript
{
  apiKey: undefined,
  authDomain: undefined,
  projectId: undefined,
  storageBucket: undefined,
  messagingSenderId: undefined,
  appId: undefined
}
```

または

```javascript
undefined  // window.__FIREBASE_CONFIG__ 自体が存在しない
```

### 3. HTMLソースを確認

ブラウザで「ページのソースを表示」（右クリック → ページのソースを表示）：

#### ✅ 正常な場合

```html
<head>
  <script>window.__FIREBASE_CONFIG__ = {"apiKey":"AIzaSyBxxx...","authDomain":"your-project.firebaseapp.com",...};</script>
</head>
```

#### ❌ 問題がある場合

```html
<head>
  <script>window.__FIREBASE_CONFIG__ = {"apiKey":undefined,"authDomain":undefined,...};</script>
</head>
```

または、スクリプトタグ自体が存在しない。

## 問題別の対処法

### ケース1: `window.__FIREBASE_CONFIG__`が`undefined`だらけ

**原因**: ランタイム環境変数が設定されていない

**解決策**:

```bash
gcloud run services update kids-science-lab \
  --region asia-northeast1 \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID"
```

### ケース2: `window.__FIREBASE_CONFIG__`自体が存在しない

**原因**: `FirebaseConfigScript`コンポーネントがレンダリングされていない

**確認**:

```bash
# src/app/layout.tsx を確認
cat src/app/layout.tsx | grep FirebaseConfigScript
```

以下が含まれているか確認：

```typescript
import { FirebaseConfigScript } from "./firebase-config-script";

// ...

<head>
  <FirebaseConfigScript />
</head>
```

### ケース3: ビルド後も`undefined`のまま

**原因**: ビルド時に環境変数が渡されていない

**解決策**: 再ビルドが必要

```bash
# 環境変数を設定
source .env.deploy

# デプロイスクリプトで再ビルド・再デプロイ
./deploy.sh
```

## Cloud Runのログを確認

### サーバーサイドのログを確認

```bash
# 最新50件のログを表示
gcloud run services logs read kids-science-lab \
  --region asia-northeast1 \
  --limit 50

# リアルタイムでログを監視
gcloud run services logs tail kids-science-lab \
  --region asia-northeast1
```

### 確認すべきログ

#### ✅ 正常な場合

```
[Firebase] Initializing with config: { apiKey: 'AIzaSyBxxx...', ... }
[Firebase] Initialized successfully
```

#### ❌ 問題がある場合

```
[FirebaseConfigScript] Missing Firebase configuration
```

または

```
FirebaseError: Firebase: Error (auth/invalid-api-key)
```

## 環境変数の確認

### Cloud Runの環境変数を確認

```bash
gcloud run services describe kids-science-lab \
  --region asia-northeast1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

#### ✅ 正常な場合

```yaml
env:
- name: NEXT_PUBLIC_FIREBASE_API_KEY
  value: AIzaSyBxxx...
- name: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  value: your-project.firebaseapp.com
- name: NEXT_PUBLIC_FIREBASE_PROJECT_ID
  value: your-project-id
# ... 他の環境変数
```

#### ❌ 問題がある場合

環境変数が表示されない、または値が空。

## よくある誤解

### 誤解1: 「Cloud Runの環境変数を設定すれば動く」

❌ **間違い**: Cloud Runの環境変数設定だけでは不十分

✅ **正しい**: ビルド時（`--build-arg`）とランタイム（`--set-env-vars`）の両方が必要

### 誤解2: 「一度ビルドすれば、環境変数を変更するだけで動く」

❌ **間違い**: 環境変数を変更しても、既にビルドされたコードは変わらない

✅ **正しい**: 環境変数を変更したら、必ず再ビルドが必要

### 誤解3: 「ローカルで動くから本番でも動くはず」

❌ **間違い**: ローカルと本番では環境変数の読み込み方が違う

✅ **正しい**: 
- ローカル: `.env.local`から自動読み込み
- 本番: ビルド時とランタイムで明示的に渡す必要がある

## チェックリスト

デプロイ前に以下を確認：

- [ ] `.env.deploy`ファイルを作成し、実際の値を設定した
- [ ] `source .env.deploy`で環境変数を読み込んだ
- [ ] `./deploy.sh`でビルド・デプロイを実行した
- [ ] ビルドログに「Building with Firebase config」が表示された
- [ ] Cloud Runの環境変数が設定されている（`gcloud run services describe`で確認）
- [ ] ブラウザで`window.__FIREBASE_CONFIG__`に値が入っている
- [ ] ブラウザコンソールに「[Firebase] Initialized successfully」が表示される

## トラブルシューティングフロー

```
Firebase Error発生
    ↓
ブラウザコンソールを確認
    ↓
window.__FIREBASE_CONFIG__ を確認
    ↓
┌─────────────────────────────────────┐
│ undefined だらけ？                   │
└─────────────────────────────────────┘
    ↓ YES
ランタイム環境変数を設定
gcloud run services update --set-env-vars=...
    ↓
再度確認
    ↓
┌─────────────────────────────────────┐
│ まだ undefined？                     │
└─────────────────────────────────────┘
    ↓ YES
再ビルド・再デプロイが必要
source .env.deploy
./deploy.sh
    ↓
┌─────────────────────────────────────┐
│ window.__FIREBASE_CONFIG__ 自体が   │
│ 存在しない？                         │
└─────────────────────────────────────┘
    ↓ YES
src/app/layout.tsx を確認
FirebaseConfigScript が含まれているか？
    ↓
含まれていない場合は追加
    ↓
再ビルド・再デプロイ
```

## 参考コマンド集

```bash
# 環境変数を設定してデプロイ
source .env.deploy && ./deploy.sh

# Cloud Runの環境変数を確認
gcloud run services describe kids-science-lab --region asia-northeast1 --format="yaml(spec.template.spec.containers[0].env)"

# ログを確認
gcloud run services logs read kids-science-lab --region asia-northeast1 --limit 50

# 環境変数を更新（再ビルド不要）
gcloud run services update kids-science-lab --region asia-northeast1 --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=xxx"

# 完全に再デプロイ（再ビルド含む）
source .env.deploy && ./deploy.sh
```
