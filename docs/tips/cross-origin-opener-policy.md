# Cross-Origin-Opener-Policy によるポップアップブロック問題

## 発生した事象

Cloud Run にデプロイした Next.js アプリで、Firebase Authentication の Google ログイン（ポップアップ方式）が動作しなくなった。

ブラウザコンソールに以下のエラーが表示される:

```
Cross-Origin-Opener-Policy policy would block the window.closed call.
```

（`35f72a89aa18f1e3.js` など Next.js のビルド済み JS ファイルから発生）

## 原因

Cloud Run 環境（またはデフォルト設定）で、レスポンスヘッダーに以下が付与されていた:

```
Cross-Origin-Opener-Policy: same-origin
```

`same-origin` は、異なるオリジンのポップアップウィンドウとの通信を完全にブロックする。
Firebase Auth の `signInWithPopup` は Google のログイン画面を別オリジンのポップアップで開き、
親ウィンドウから `window.closed` を呼んでポップアップの状態を監視する仕組みになっている。
`same-origin` ポリシーだとこの `window.closed` の呼び出し自体がブロックされ、ログインフローが完了しない。

## 解決方法

`next.config.ts` に `headers()` を追加し、`Cross-Origin-Opener-Policy` を `same-origin-allow-popups` に緩和する。

```ts
// next.config.ts
const nextConfig: NextConfig = {
  // ...既存の設定
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};
```

設定後、再デプロイすれば反映される。

## ポイント

| 値 | 挙動 |
|---|---|
| `same-origin` | 異なるオリジンのポップアップとの通信を完全ブロック |
| `same-origin-allow-popups` | 自分が開いたポップアップとの通信は許可 |
| `unsafe-none` | 制限なし（非推奨） |

`same-origin-allow-popups` はセキュリティを維持しつつ、Firebase Auth のポップアップログインに必要な `window.closed` 呼び出しを許可するバランスの良い設定。

## 対象環境

- Next.js（App Router / Pages Router 共通）
- Cloud Run デプロイ時
- Firebase Authentication の `signInWithPopup` を使用している場合
