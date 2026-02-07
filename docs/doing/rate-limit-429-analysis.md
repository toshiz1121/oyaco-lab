# Vertex AI レート制限エラー（429）の分析

## 📋 概要

ステップ3の画像生成で必ず429エラー（Too Many Requests）が発生する問題の分析結果です。

**エラーメッセージ**:
```
Error [ClientError]: [VertexAI.ClientError]: got status: 429 Too Many Requests
Resource exhausted. Please try again later.
```

**発生箇所**: `src/lib/vertexai.ts:213` (generateIllustration関数内)

---

## 🔍 現状の実装分析

### 1. リトライ設定（vertexai.ts）

```typescript
export const VERTEX_AI_CONFIG = {
    retry: {
        maxAttempts: 3,      // 最大リトライ回数
        initialDelay: 1000,  // 初回リトライまでの待機時間（1秒）
        maxDelay: 10000      // 最大待機時間（10秒）
    }
}
```

**問題点**:
- ✅ リトライロジックは実装されている
- ❌ 429エラーに対する特別な処理がない
- ❌ リトライ間隔が短すぎる（1秒 → 2秒 → 4秒）

### 2. バックグラウンド画像生成（useBackgroundImageGenerator.ts）

```typescript
const MAX_PARALLEL = 1; // レート制限対策: 同時に1つのみ実行
const REQUEST_DELAY = 3000; // リクエスト間の遅延（3秒）
```

**実装内容**:
- ✅ 並列実行数を1に制限
- ✅ リクエスト間に3秒の遅延
- ✅ 順次処理を実装

**問題点**:
- ❌ 最初のペア（ステップ1）の画像生成は別処理
- ❌ 複数の画像生成リクエストが短時間に集中する可能性

### 3. 画像生成の呼び出しフロー

```
1. 回答生成完了 → 4つのペア（pair-1, pair-2, pair-3, pair-4）
2. pair-1の画像生成（サーバー側で即座に実行）
3. ResultView表示
4. useBackgroundImageGenerator起動
5. pair-2の画像生成開始（3秒待機後）
6. pair-3の画像生成開始（さらに3秒待機後）← ここで429エラー
7. pair-4の画像生成開始（さらに3秒待機後）
```

---

## 🔴 問題点の整理

### 問題1: 画像生成と音声生成の同時実行

**実際のタイムライン**:
```
時刻 0秒:   pair-1 画像生成（サーバー側）
時刻 0秒:   pair-1 音声生成（サーバー側）
時刻 3秒:   pair-2 画像生成開始
時刻 3秒:   pair-2 音声生成開始 ← 同時に実行！
時刻 3.1秒: pair-3 音声生成開始 ← 0.1秒後に実行！
時刻 3.2秒: pair-4 音声生成開始 ← さらに0.1秒後！
時刻 6秒:   pair-3 画像生成開始 ← 429エラー発生
```

**根本原因**:
- **画像生成**: 3秒間隔で順次実行（MAX_PARALLEL=1, REQUEST_DELAY=3000）
- **音声生成**: 0.1秒間隔で順次実行（待機時間が短すぎる）
- **両方が同時に走る** → レート制限を超える

**Vertex AIのレート制限**:
- gemini-2.5-flash-image: **60 RPM**（1分間に60リクエスト）
- gemini-2.5-flash-tts: **60 RPM**（1分間に60リクエスト）
- **合計で120 RPM必要** → 実際は60 RPMしかない可能性

### 問題2: 音声生成の待機時間が短すぎる

```typescript
// useBackgroundAudioGenerator.ts
await new Promise(resolve => setTimeout(resolve, 100)); // 0.1秒！
```

**問題点**:
- 音声生成のリクエスト間隔が0.1秒
- 3つの音声を0.3秒で連続リクエスト
- 画像生成と同時に実行される
- **レート制限を簡単に超える**

**実際のリクエスト数**:
```
3秒間に:
- 画像生成: 1リクエスト
- 音声生成: 3リクエスト
= 合計4リクエスト

1秒あたり: 約1.3リクエスト
→ レート制限（1秒に1リクエスト）を超える
```

### 問題3: 画像生成と音声生成の調整がない

```typescript
// ResultView.tsx（推測）
useBackgroundImageGenerator(pairs, onPairUpdate);  // 画像生成開始
useBackgroundAudioGenerator(pairs, onAudioUpdate); // 音声生成開始（同時）
```

**問題点**:
- 両方のフックが独立して動作
- リクエストタイミングの調整がない
- 同じVertex AIエンドポイントを使用
- **レート制限を共有している可能性**

---

## 📊 Vertex AIのレート制限

### 公式ドキュメントの情報

| モデル | レート制限 | 備考 |
|--------|-----------|------|
| gemini-2.5-flash-image | 60 RPM | 1分間に60リクエスト |
| gemini-2.5-flash | 1000 RPM | テキスト生成 |
| gemini-2.5-flash-tts | 60 RPM | 音声合成 |

**RPM (Requests Per Minute)**: 1分間あたりのリクエスト数

### 計算

```
60 RPM = 1秒に1リクエスト

実際の使用:
- 1つの質問で4つの画像生成
- リトライを含めると最大12リクエスト（4 × 3回）
- 3秒間隔でも、リトライで間隔が詰まる
```

---

## 🚨 問題になりそうなポイント

### 1. リトライ間隔が短すぎる

**現状**: 1秒 → 2秒 → 4秒

**推奨**: 429エラーの場合は指数バックオフを強化
- 1回目: 5秒
- 2回目: 10秒
- 3回目: 20秒

### 2. 429エラーの特別処理がない

**現状**: すべてのエラーで同じリトライロジック

**推奨**: 429エラーの場合は別処理
```typescript
if (error.status === 429) {
    // より長い待機時間
    const retryAfter = error.headers?.['retry-after'] || 60;
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
}
```

### 3. リクエスト間隔が不十分

**現状**: 3秒間隔

**推奨**: 5秒以上の間隔
- リトライを考慮すると、3秒では不十分
- 安全マージンを持たせる

### 4. 並列実行数の制限が不十分

**現状**: MAX_PARALLEL = 1（順次処理）

**問題**: 
- 最初のペアの画像生成は別処理
- 実質的に並列実行される可能性

**推奨**: グローバルなレート制限管理
```typescript
// アプリ全体で画像生成リクエストを管理
class ImageGenerationQueue {
    private static lastRequestTime = 0;
    private static MIN_INTERVAL = 5000; // 5秒
    
    static async waitForSlot() {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.MIN_INTERVAL) {
            await new Promise(resolve => 
                setTimeout(resolve, this.MIN_INTERVAL - elapsed)
            );
        }
        this.lastRequestTime = Date.now();
    }
}
```

### 5. エラーハンドリングが不十分

**現状**: エラーをログに出力するのみ

**推奨**: ユーザーへのフィードバック
```typescript
if (error.status === 429) {
    toast.warning("画像生成が混雑しています。少し待ってから再試行します...");
}
```

### 6. リトライ回数が多すぎる

**現状**: maxAttempts = 3

**問題**: 
- 3回リトライすると、1つの画像で最大4リクエスト
- 4つの画像で最大16リクエスト
- レート制限を超える可能性が高い

**推奨**: 429エラーの場合はリトライ回数を減らす
```typescript
if (error.status === 429) {
    maxAttempts = 1; // リトライしない、または1回のみ
}
```

---

## 📈 推奨される改善策（優先順位順）

### 優先度1: 429エラーの特別処理

```typescript
async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            // 429エラーの場合は特別処理
            if (error.status === 429) {
                const retryAfter = error.headers?.['retry-after'] || 60;
                console.warn(`[Vertex AI] Rate limited. Waiting ${retryAfter}s...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue; // リトライカウントを増やさない
            }
            
            // 通常のリトライロジック
            // ...
        }
    }
}
```

### 優先度2: リクエスト間隔の延長

```typescript
const REQUEST_DELAY = 5000; // 3秒 → 5秒に延長
```

### 優先度3: グローバルなレート制限管理

```typescript
// シングルトンでリクエストタイミングを管理
class RateLimiter {
    private static instance: RateLimiter;
    private lastRequestTime = 0;
    private readonly MIN_INTERVAL = 5000;
    
    static getInstance() {
        if (!this.instance) {
            this.instance = new RateLimiter();
        }
        return this.instance;
    }
    
    async waitForSlot() {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.MIN_INTERVAL) {
            const waitTime = this.MIN_INTERVAL - elapsed;
            console.log(`[RateLimiter] Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
    }
}

// 使用例
export async function generateIllustration(prompt: string): Promise<string | undefined> {
    await RateLimiter.getInstance().waitForSlot();
    // 画像生成処理
}
```

### 優先度4: エクスポネンシャルバックオフの強化

```typescript
// 429エラーの場合は、より長い待機時間
const exponentialDelay = error.status === 429
    ? Math.min(initialDelay * Math.pow(3, attempt - 1), maxDelay) // 3倍ずつ増加
    : Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay); // 2倍ずつ増加
```

### 優先度5: ユーザーへのフィードバック

```typescript
if (error.status === 429) {
    toast.info("画像生成が混雑しています。自動的に再試行します...", {
        duration: 5000
    });
}
```

---

## 🧪 テスト方法

### 1. レート制限の再現

```typescript
// 意図的に短い間隔でリクエストを送信
for (let i = 0; i < 10; i++) {
    generateIllustration(`Test prompt ${i}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒間隔
}
```

### 2. リトライロジックの確認

```typescript
// コンソールログで確認
console.log('[Vertex AI] Retry attempt 1/3 after 1300ms');
console.log('[Vertex AI] Retry attempt 2/3 after 2600ms');
console.log('[Vertex AI] Retry attempt 3/3 after 5200ms');
```

### 3. 429エラーのハンドリング

```typescript
// 429エラーが発生した場合の動作を確認
// - 適切な待機時間
// - ユーザーへの通知
// - 最終的な成功/失敗
```

---

## 📝 まとめ

### 根本原因

1. **リトライによるリクエスト増幅**
   - 1つの画像で最大4リクエスト（初回 + 3回リトライ）
   - 4つの画像で最大16リクエスト
   - 3秒間隔でも、リトライで間隔が詰まる

2. **429エラーの特別処理がない**
   - すべてのエラーで同じリトライロジック
   - レート制限に対する適切な待機時間がない

3. **リクエスト間隔が不十分**
   - 3秒間隔では、リトライを考慮すると不十分
   - 安全マージンが必要

### 推奨される対策

1. **429エラーの特別処理を追加**（最優先）
2. **リクエスト間隔を5秒以上に延長**
3. **グローバルなレート制限管理を実装**
4. **エクスポネンシャルバックオフを強化**
5. **ユーザーへのフィードバックを追加**

### 期待される効果

- ✅ 429エラーの発生率を大幅に削減
- ✅ ユーザー体験の向上（エラーメッセージの改善）
- ✅ システムの安定性向上
- ✅ Vertex AIのレート制限に準拠

---

**作成日**: 2025年2月7日  
**ステータス**: 分析完了、修正待ち  
**次のステップ**: 優先度1〜3の改善策を実装
