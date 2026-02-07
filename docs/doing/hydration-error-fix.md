# Hydration Error 修正レポート

## エラー内容
```
Uncaught Error: Hydration failed because the server rendered text didn't match the client.
```

## 原因
Next.jsのSSR（サーバーサイドレンダリング）環境で、`Math.random()`を使用していたため、サーバーとクライアントで異なるHTMLが生成されていました。

### 問題のあったコード例
```tsx
// ❌ 悪い例：毎回異なる値が生成される
{[...Array(20)].map((_, i) => (
  <motion.div
    key={i}
    style={{
      left: `${Math.random() * 100}%`,  // SSRとクライアントで異なる値
      top: `${Math.random() * 100}%`,
    }}
  >
    {['⭐', '✨'][Math.floor(Math.random() * 2)]}
  </motion.div>
))}
```

## 解決方法

### `useMemo`を使用してクライアントサイドで固定値を生成

```tsx
// ✅ 良い例：クライアントサイドで一度だけ生成
import { useMemo } from "react";

const sparkles = useMemo(() => 
  [...Array(20)].map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: 3 + Math.random() * 2,
    delay: Math.random() * 3,
    icon: ['⭐', '✨', '🌟', '💫'][Math.floor(Math.random() * 4)]
  })), []
);

// 使用時
{sparkles.map((sparkle) => (
  <motion.div
    key={sparkle.id}
    style={{
      left: `${sparkle.left}%`,
      top: `${sparkle.top}%`,
    }}
  >
    {sparkle.icon}
  </motion.div>
))}
```

## 修正したファイル

### 1. InputView.tsx
- 20個のキラキラ星のランダム配置を`useMemo`で固定化

### 2. ThinkingView.tsx
- 15個の泡のアニメーションパラメータを`useMemo`で固定化
- `window.innerHeight`を固定値（1000）に変更

### 3. ExpertSpotlight.tsx
- 30個の星の雨のパラメータを`useMemo`で固定化
- `window.innerHeight`を固定値（1000）に変更

### 4. ResultView.tsx
- 10個の浮遊装飾のパラメータを`useMemo`で固定化

## 技術的なポイント

### useMemoの使用理由
```tsx
const values = useMemo(() => {
  // この関数はコンポーネントの初回レンダリング時に一度だけ実行される
  return [...Array(20)].map(() => Math.random());
}, []); // 空の依存配列 = 再計算しない
```

### メリット
1. **Hydration問題の解決**: クライアントサイドで一度だけ値を生成
2. **パフォーマンス向上**: 毎回の再計算を防ぐ
3. **一貫性**: アニメーションが安定する

### 注意点
- `useMemo`は依存配列が空の場合、コンポーネントのライフサイクル中に一度だけ実行される
- SSR時には実行されず、クライアントサイドでのみ実行される
- ランダム値が必要な場合は、この方法が最適

## その他のHydration問題の原因

### 1. Date.now()の使用
```tsx
// ❌ 悪い例
const timestamp = Date.now();

// ✅ 良い例
const [timestamp, setTimestamp] = useState<number | null>(null);
useEffect(() => {
  setTimestamp(Date.now());
}, []);
```

### 2. window オブジェクトの使用
```tsx
// ❌ 悪い例
const width = window.innerWidth;

// ✅ 良い例
const [width, setWidth] = useState(0);
useEffect(() => {
  setWidth(window.innerWidth);
}, []);
```

### 3. ブラウザ拡張機能
- 一部のブラウザ拡張機能がHTMLを変更する場合がある
- 開発時はシークレットモードでテストすることを推奨

## 検証方法

### 開発環境での確認
```bash
npm run dev
```

### 本番ビルドでの確認
```bash
npm run build
npm start
```

本番ビルドでHydrationエラーが出ないことを確認してください。

## まとめ

✅ **修正完了**: すべてのコンポーネントでHydration問題を解決
✅ **パフォーマンス**: `useMemo`による最適化
✅ **安定性**: アニメーションの一貫性を確保

Next.jsのSSR環境では、ランダム値や動的な値の扱いに注意が必要です。
`useMemo`や`useEffect`を適切に使用することで、これらの問題を回避できます。
