# 環境変数の仕組み - 初学者向け解説

## 問題: なぜローカルでは動くのに本番環境で動かないのか？

### 1. 環境変数とは？

環境変数は「設定値を外部から渡す仕組み」です。

```javascript
// コードに直接書く（悪い例）
const apiKey = "AIzaSyBxxx...";  // ❌ コードに秘密情報を書くのは危険

// 環境変数から読み取る（良い例）
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;  // ✅ 外部から渡す
```

### 2. Next.jsの環境変数の特殊な仕組み

Next.jsでは、`NEXT_PUBLIC_`で始まる環境変数は**ビルド時にコードに埋め込まれます**。

#### ローカル開発の場合

```bash
# .env.local ファイル
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBxxx...
```

```bash
npm run dev
```

↓

```javascript
// 実行時に環境変数が読み込まれる
console.log(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
// 出力: "AIzaSyBxxx..."  ✅
```

#### 本番環境（Docker）の場合

```bash
# Dockerfileでビルド
docker build -t myapp .
```

↓ ビルド時に環境変数がない

```javascript
// ビルドされたコード（バンドル.js）
const apiKey = undefined;  // ❌ 環境変数が埋め込まれていない
```

↓ Cloud Runで実行

```javascript
console.log(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
// 出力: undefined  ❌
```

### 3. なぜ「ビルド時」と「ランタイム」の両方が必要なのか？

Next.jsアプリには2つの実行場所があります：

#### A. クライアントサイド（ブラウザ）

```javascript
// ブラウザで実行されるコード
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY  // ← ビルド時に埋め込まれる
};
```

ブラウザは環境変数にアクセスできないので、**ビルド時に値を埋め込む**必要があります。

```javascript
// ビルド後のコード（ブラウザで実行）
const config = {
  apiKey: "AIzaSyBxxx..."  // ← 値が直接埋め込まれている
};
```

#### B. サーバーサイド（Node.js）

```javascript
// サーバーで実行されるコード（SSR）
export function FirebaseConfigScript() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;  // ← ランタイムで読み取る
  return <script>window.__CONFIG__ = {apiKey: "{apiKey}"}</script>;
}
```

サーバーサイドは環境変数にアクセスできるので、**ランタイムで読み取る**ことができます。

### 4. 図解: ビルド時 vs ランタイム

```
┌─────────────────────────────────────────────────────────┐
│                    開発環境（ローカル）                    │
└─────────────────────────────────────────────────────────┘

.env.local ファイル
  ↓
npm run dev（開発サーバー）
  ↓
┌──────────────────┐
│ サーバーサイド    │ → 環境変数を読み取る ✅
│ (Node.js)        │
└──────────────────┘
  ↓ HTMLを生成
┌──────────────────┐
│ クライアントサイド │ → 環境変数が埋め込まれている ✅
│ (ブラウザ)        │
└──────────────────┘


┌─────────────────────────────────────────────────────────┐
│              本番環境（Cloud Run）- 問題のケース           │
└─────────────────────────────────────────────────────────┘

docker build（環境変数なし）
  ↓
┌──────────────────┐
│ バンドル.js      │ → apiKey: undefined ❌
└──────────────────┘
  ↓
Cloud Runで実行
  ↓
┌──────────────────┐
│ サーバーサイド    │ → 環境変数を読み取れる ✅
│ (Node.js)        │    （Cloud Runの環境変数設定から）
└──────────────────┘
  ↓ HTMLを生成
┌──────────────────┐
│ クライアントサイド │ → apiKey: undefined ❌
│ (ブラウザ)        │    （ビルド時に埋め込まれていない）
└──────────────────┘


┌─────────────────────────────────────────────────────────┐
│              本番環境（Cloud Run）- 正しいケース           │
└─────────────────────────────────────────────────────────┘

docker build --build-arg API_KEY=xxx（環境変数あり）
  ↓
┌──────────────────┐
│ バンドル.js      │ → apiKey: "xxx" ✅
└──────────────────┘
  ↓
Cloud Run（--set-env-vars API_KEY=xxx）
  ↓
┌──────────────────┐
│ サーバーサイド    │ → 環境変数を読み取れる ✅
│ (Node.js)        │
└──────────────────┘
  ↓ HTMLを生成
┌──────────────────┐
│ クライアントサイド │ → apiKey: "xxx" ✅
│ (ブラウザ)        │
└──────────────────┘
```

### 5. 実際のコード例

#### 問題のあるデプロイ

```bash
# ❌ 環境変数を渡さずにビルド
docker build -t myapp .

# Cloud Runにデプロイ（ランタイム環境変数のみ設定）
gcloud run deploy myapp \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=xxx"
```

結果:
- サーバーサイド: ✅ 環境変数が読み取れる
- クライアントサイド: ❌ `undefined`（ビルド時に埋め込まれていない）

#### 正しいデプロイ

```bash
# ✅ ビルド時に環境変数を渡す
docker build \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=xxx \
  -t myapp .

# Cloud Runにデプロイ（ランタイム環境変数も設定）
gcloud run deploy myapp \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=xxx"
```

結果:
- サーバーサイド: ✅ 環境変数が読み取れる
- クライアントサイド: ✅ ビルド時に埋め込まれた値が使える

### 6. なぜ両方必要なのか？

| タイミング | 目的 | 理由 |
|-----------|------|------|
| **ビルド時** (`--build-arg`) | クライアントサイドのコードに値を埋め込む | ブラウザは環境変数にアクセスできないため |
| **ランタイム** (`--set-env-vars`) | サーバーサイドで環境変数を読み取る | SSR時に動的にHTMLを生成するため |

### 7. 確認方法

#### ビルド時に埋め込まれているか確認

```bash
# ビルドログを確認
docker build --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=xxx -t myapp .

# 出力例:
# Building with Firebase config:
# API_KEY: AIzaSyBxxx...  ← これが表示されればOK
```

#### ランタイムで読み取れるか確認

```bash
# Cloud Runの環境変数を確認
gcloud run services describe myapp \
  --format="yaml(spec.template.spec.containers[0].env)"

# 出力例:
# - name: NEXT_PUBLIC_FIREBASE_API_KEY
#   value: AIzaSyBxxx...  ← これが表示されればOK
```

#### ブラウザで確認

```javascript
// ブラウザのコンソールで実行
console.log(window.__FIREBASE_CONFIG__);

// 出力例:
// {apiKey: "AIzaSyBxxx...", ...}  ← 値があればOK
// {apiKey: undefined, ...}        ← undefinedならNG
```

### 8. まとめ

| 環境 | ビルド時の環境変数 | ランタイムの環境変数 | 結果 |
|------|-------------------|---------------------|------|
| ローカル開発 | `.env.local`から自動読み込み | `.env.local`から自動読み込み | ✅ 動く |
| Cloud Run（間違い） | ❌ なし | ✅ `--set-env-vars` | ❌ エラー |
| Cloud Run（正しい） | ✅ `--build-arg` | ✅ `--set-env-vars` | ✅ 動く |

**重要**: Next.jsの`NEXT_PUBLIC_*`環境変数は、ビルド時とランタイムの**両方**で設定する必要があります。

## 参考: Zenn記事との違い

Zenn記事の問題:
- `export const auth`を`export default auth`に変更
- これは**モジュールのエクスポート方法の問題**
- 環境変数とは無関係

あなたの問題:
- 環境変数がビルド時に埋め込まれていない
- これは**Dockerビルドの設定の問題**
- `default export`とは無関係

記事のタイトルは同じエラーメッセージですが、**原因は全く別**です。
