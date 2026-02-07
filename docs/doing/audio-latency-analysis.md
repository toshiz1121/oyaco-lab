# 音声再生レイテンシー分析と改善計画

## 現状の処理フロー分析

### 1. 全体のフロー（並列生成モード）

```
ユーザー質問
  ↓
consultAction (actions.ts)
  ├─ decideAgent() - エージェント選択
  ├─ generateExpertResponse() - 説明文生成
  ├─ createSentenceImagePairs() - ペア配列作成
  └─ generateIllustration() - 最初の画像のみ生成
  ↓
ResultView表示
  ↓
ParallelResultView
  ├─ useBackgroundImageGenerator - 残りの画像を順次生成
  └─ useEffect (currentIndex変更時)
      ├─ stop() - 前の音声停止
      ├─ setTimeout(100ms) - 遅延
      └─ speak() - 音声生成＆再生
          ├─ generateSpeechAction() - サーバーで音声生成 ⚠️
          └─ audio.play() - 再生開始
```

### 2. 特定されたボトルネック

#### 🔴 **ボトルネック1: 音声生成の遅延（最大の問題）**
**場所**: `ParallelResultView` の `useEffect` → `speak()` → `generateSpeechAction()`

**問題点**:
- 画像が生成完了してから音声生成を開始している
- Vertex AI TTSへのAPI呼び出しは1-3秒かかる
- ユーザーは画像を見ながら音声を待つ状態になる

**現在のコード**:
```typescript
// ResultView.tsx (ParallelResultView)
useEffect(() => {
  if (currentPair && currentPair.text) {
    stop();
    const timer = setTimeout(() => {
      speak(currentPair.text); // ⚠️ ここで初めて音声生成開始
    }, 100);
    return () => clearTimeout(timer);
  }
}, [currentIndex]);
```

**レイテンシー**: 1-3秒（Vertex AI TTS API呼び出し）

---

#### 🟡 **ボトルネック2: 音声の事前読み込みがない**
**場所**: `ParallelResultView`

**問題点**:
- 旧フロー（LegacyResultView）では`loadAudio()`で事前読み込みとプリフェッチを実装
- 新フロー（ParallelResultView）では`speak()`のみ使用し、事前読み込みなし
- 次のペアの音声も準備されていない

**旧フローの良い実装例**:
```typescript
// LegacyResultView
const playStep = async (index: number) => {
  // 現在のステップの音声を読み込み
  let loadedAudio = audioCache.current.get(index);
  if (!loadedAudio) {
    loadedAudio = await loadAudio(textToSpeak); // ⚠️ 事前読み込み
    audioCache.current.set(index, loadedAudio);
  }
  
  // 次のステップの音声をプリフェッチ ⚠️
  if (index < steps.length - 1 && !audioCache.current.has(index + 1)) {
    loadAudio(nextText).then(nextAudio => {
      audioCache.current.set(index + 1, nextAudio);
    });
  }
};
```

---

#### 🟢 **ボトルネック3: 100msの不要な遅延**
**場所**: `ParallelResultView` の `useEffect`

**問題点**:
- `setTimeout(100ms)`で意図的に遅延を入れている
- コメントには「音声の重複を防ぐ」とあるが、`stop()`で既に停止済み

**現在のコード**:
```typescript
stop();
const timer = setTimeout(() => {
  speak(currentPair.text);
}, 100); // ⚠️ 不要な遅延
```

**レイテンシー**: 100ms（不要）

---

### 3. レイテンシーの内訳

| 処理 | 時間 | 備考 |
|------|------|------|
| 画像生成完了 | - | ユーザーが画像を見る |
| setTimeout遅延 | 100ms | 不要 |
| generateSpeechAction呼び出し | 1-3秒 | **最大のボトルネック** |
| 音声データ転送 | 100-300ms | ネットワーク |
| 音声再生開始 | 即座 | - |
| **合計レイテンシー** | **1.2-3.4秒** | - |

---

## 改善計画

### 目標
**画像生成完了と同時に音声再生を開始する（レイテンシー: 0-100ms）**

---

### 改善策1: 音声の事前生成（最優先）

#### 実装方針
1. **サーバー側で音声を事前生成**
   - `consultAction`で説明文生成時に、全ペアの音声も並列生成
   - 音声データをレスポンスに含める

2. **クライアント側でキャッシュ**
   - 音声データを受け取ったら即座にAudioオブジェクトを作成
   - ペアごとにキャッシュして即座に再生可能にする

#### 実装箇所
**actions.ts**:
```typescript
export async function consultAction(...) {
  // ... 既存の処理 ...
  
  // ステップ4: 全ペアの音声を並列生成
  const audioPromises = pairs.map(pair => 
    generateSpeechAction(pair.text)
  );
  const audioResults = await Promise.all(audioPromises);
  
  // 音声データをペアに追加
  pairs.forEach((pair, index) => {
    pair.audioData = audioResults[index];
  });
  
  return { success: true, data: response };
}
```

**ResultView.tsx**:
```typescript
// 音声キャッシュを初期化
useEffect(() => {
  const cache = new Map<string, LoadedAudio>();
  
  pairs.forEach(pair => {
    if (pair.audioData) {
      const audioUrl = `data:audio/wav;base64,${pair.audioData}`;
      const audio = new Audio(audioUrl);
      cache.set(pair.id, { audio, duration: 0, play: () => audio.play() });
    }
  });
  
  audioCache.current = cache;
}, []);

// ペア変更時に即座に再生
useEffect(() => {
  const cached = audioCache.current.get(currentPair.id);
  if (cached) {
    cached.play(); // ⚠️ 即座に再生（レイテンシー: 0ms）
  }
}, [currentIndex]);
```

**期待効果**: レイテンシー 1.2-3.4秒 → 0-100ms（95%削減）

---

### 改善策2: 段階的な音声生成（代替案）

サーバー側で全音声を生成するとAPI呼び出しが重くなる場合の代替案。

#### 実装方針
1. **最初の2ペアの音声を事前生成**
   - `consultAction`で最初の2ペアの音声を生成
   - 残りはバックグラウンドで生成

2. **プリフェッチ機能の実装**
   - 現在のペアを表示中に、次のペアの音声を生成
   - LegacyResultViewの実装を参考にする

#### 実装箇所
**actions.ts**:
```typescript
// 最初の2ペアの音声を生成
if (pairs.length > 0) {
  pairs[0].audioData = await generateSpeechAction(pairs[0].text);
}
if (pairs.length > 1) {
  pairs[1].audioData = await generateSpeechAction(pairs[1].text);
}
```

**ResultView.tsx**:
```typescript
// 次のペアの音声をプリフェッチ
useEffect(() => {
  const nextIndex = currentIndex + 1;
  if (nextIndex < pairs.length && !audioCache.current.has(pairs[nextIndex].id)) {
    loadAudio(pairs[nextIndex].text).then(audio => {
      audioCache.current.set(pairs[nextIndex].id, audio);
    });
  }
}, [currentIndex]);
```

**期待効果**: 最初の2ペアは即座、残りは1-2秒のレイテンシー

---

### 改善策3: 100ms遅延の削除

#### 実装方針
`setTimeout`を削除し、`stop()`の直後に再生開始。

#### 実装箇所
**ResultView.tsx**:
```typescript
useEffect(() => {
  if (currentPair && currentPair.text) {
    stop();
    speak(currentPair.text); // ⚠️ 遅延なし
  }
}, [currentIndex]);
```

**期待効果**: 100ms削減

---

## 推奨実装順序

### フェーズ1: 即効性のある改善（1-2時間）
1. ✅ 100ms遅延の削除
2. ✅ 最初の2ペアの音声事前生成

### フェーズ2: 根本的な改善（3-4時間）
3. ✅ 全ペアの音声事前生成
4. ✅ クライアント側の音声キャッシュ実装
5. ✅ 型定義の更新（SentenceImagePairにaudioData追加）

### フェーズ3: 最適化（1-2時間）
6. ✅ プリフェッチ機能の実装（次のペアの音声を先読み）
7. ✅ エラーハンドリングの強化

---

## 期待される改善効果

| 項目 | 現状 | 改善後 | 削減率 |
|------|------|--------|--------|
| 最初のペア | 1.2-3.4秒 | 0-100ms | 95%+ |
| 2番目のペア | 1.2-3.4秒 | 0-100ms | 95%+ |
| 3番目以降 | 1.2-3.4秒 | 0-100ms | 95%+ |

---

## リスクと対策

### リスク1: サーバー側の処理時間増加
**対策**: 
- 音声生成を並列実行（Promise.all）
- タイムアウト設定（10秒）
- 失敗時はクライアント側でフォールバック

### リスク2: レスポンスサイズの増加
**対策**:
- 音声データは圧縮済み（WAV形式）
- 平均1ペアあたり50-100KB
- 4ペアで200-400KB（許容範囲）

### リスク3: メモリ使用量の増加
**対策**:
- 音声キャッシュは使用後に解放
- 最大4-5ペア分のみ保持

---

## まとめ

**最大のボトルネック**: 画像生成後に音声生成を開始している点

**最優先の改善策**: サーバー側での音声事前生成とクライアント側キャッシュ

**期待効果**: レイテンシー95%削減（1.2-3.4秒 → 0-100ms）

**実装難易度**: 中（既存のloadAudio実装を参考にできる）

**推奨**: フェーズ1から順次実装し、段階的に改善
