# Progressive Audio Loading 実装計画

## 提案の概要

**UX改善のための段階的音声読み込み**

### 現在の問題
- 全ペアの音声生成を待ってからレスポンスを返す
- ユーザーは長時間待たされる（4ペア × 1-3秒 = 4-12秒）

### 提案されたアプローチ
1. **最初のペア（画像+音声）を優先生成**
   - 最速でユーザーに返す（2-4秒）
   - すぐに体験開始できる

2. **残りのペアをバックグラウンド生成**
   - ユーザーが最初のペアを見ている間に生成
   - 次のペアに進む頃には準備完了

### 期待効果
- **体感待ち時間**: 12秒 → 2-4秒（**70%削減**）
- **実際の総処理時間**: 変わらない（並列化により短縮の可能性も）
- **UX**: 大幅に改善（即座にコンテンツが表示される）

---

## 実装可能性の検証

### ✅ 既存の実装パターンが存在

**useBackgroundImageGenerator.ts** で既に同じパターンを実装済み：
- 最初の画像を優先生成
- 残りをバックグラウンドで順次生成
- 状態更新のコールバック機構

### ✅ 必要な技術要素が揃っている

1. **Server Actions**: 非同期処理が可能
2. **React State**: リアルタイム更新が可能
3. **Audio API**: 動的な音声読み込みが可能
4. **既存のフック**: useBackgroundImageGeneratorを参考にできる

---

## 実装アーキテクチャ

### アーキテクチャ図

```
[ユーザー質問]
    ↓
[consultAction]
    ├─ エージェント選択
    ├─ 説明文生成
    ├─ ペア配列作成
    ├─ 最初の画像生成 ⚡
    └─ 最初の音声生成 ⚡ (NEW)
    ↓
[即座にレスポンス返却] ← ⚡ ここで待ち時間終了
    ↓
[ResultView表示]
    ├─ 最初のペア表示＆音声再生 ⚡
    ├─ useBackgroundImageGenerator (既存)
    │   └─ 残りの画像を順次生成
    └─ useBackgroundAudioGenerator (NEW)
        └─ 残りの音声を順次生成
```

---

## 実装計画

### Phase 1: サーバー側の変更（actions.ts）

#### 1.1 最初のペアのみ音声生成

**現在のコード**:
```typescript
// ステップ4: 最初のペアの画像のみを先行生成
if (pairs.length > 0) {
  pairs[0].status = 'generating';
  const imageUrl = await generateIllustration(pairs[0].visualDescription);
  if (imageUrl) {
    pairs[0].imageUrl = imageUrl;
    pairs[0].status = 'ready';
  }
}
```

**変更後**:
```typescript
// ステップ4: 最初のペアの画像と音声を先行生成
if (pairs.length > 0) {
  pairs[0].status = 'generating';
  
  // 画像と音声を並列生成 ⚡
  const [imageUrl, audioData] = await Promise.all([
    generateIllustration(pairs[0].visualDescription),
    generateSpeechAction(pairs[0].text)
  ]);
  
  if (imageUrl) {
    pairs[0].imageUrl = imageUrl;
    pairs[0].audioData = audioData; // NEW
    pairs[0].status = 'ready';
    pairs[0].generatedAt = new Date();
  }
}

// ⚡ ここで即座にレスポンスを返す
// 残りのペアはクライアント側でバックグラウンド生成
```

**処理時間**: 
- 画像生成: 2-3秒
- 音声生成: 1-2秒
- 並列実行: max(2-3秒, 1-2秒) = **2-3秒**

---

### Phase 2: 型定義の更新（types.ts）

#### 2.1 SentenceImagePairにaudioData追加

```typescript
export interface SentenceImagePair {
  id: string;
  stepNumber: number;
  text: string;
  visualDescription: string;
  imageUrl: string | null;
  audioData?: string | null; // NEW: Base64エンコードされた音声データ
  status: PairStatus;
  generatedAt?: Date;
}
```

---

### Phase 3: バックグラウンド音声生成フックの作成

#### 3.1 useBackgroundAudioGenerator.ts

**useBackgroundImageGenerator.tsを参考に実装**:

```typescript
"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair } from '@/lib/agents/types';
import { generateSpeechAction } from '@/app/actions';

/**
 * バックグラウンドで音声を順次生成するカスタムフック
 * 
 * 実装背景:
 * - Progressive Loading UXのためのフック
 * - 最初のペアの音声は既に生成済み
 * - 残りのペアの音声を順次生成
 * - ユーザーが最初のペアを見ている間に次の音声を準備
 * 
 * @param pairs 文章画像ペアの配列
 * @param onAudioUpdate 音声データ更新時のコールバック
 */
export function useBackgroundAudioGenerator(
  pairs: SentenceImagePair[],
  onAudioUpdate: (pairId: string, audioData: string | null) => void
) {
  const isProcessing = useRef(false);
  const processedIds = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    // 最初のペア（すでに生成済み）をスキップ
    const firstPair = pairs[0];
    if (!firstPair || !firstPair.audioData) {
      console.log(`[DEBUG] Waiting for first pair audio to complete...`);
      return;
    }
    
    // 音声が未生成のペアを抽出
    const pendingPairs = pairs.filter(
      (p, index) => index > 0 && !p.audioData && !processedIds.current.has(p.id)
    );
    
    if (!isProcessing.current && pendingPairs.length > 0) {
      console.log(`[DEBUG] Starting background audio generation for ${pendingPairs.length} pairs`);
      processAudioQueue(pendingPairs);
    }
  }, [pairs]);
  
  const processAudioQueue = async (pendingPairs: SentenceImagePair[]) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    // 順次処理（音声生成は軽いのでレート制限は不要）
    for (const pair of pendingPairs) {
      if (processedIds.current.has(pair.id)) continue;
      
      processedIds.current.add(pair.id);
      console.log(`[DEBUG] Generating audio for ${pair.id}...`);
      
      try {
        const audioData = await generateSpeechAction(pair.text);
        onAudioUpdate(pair.id, audioData);
        console.log(`[DEBUG] Audio generated for ${pair.id}`);
      } catch (error) {
        console.error(`[ERROR] Audio generation failed for ${pair.id}:`, error);
        onAudioUpdate(pair.id, null);
      }
      
      // 次のリクエストまで少し待機（オプション）
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    isProcessing.current = false;
    console.log(`[DEBUG] Background audio generation complete`);
  };
}
```

---

### Phase 4: ResultViewの更新

#### 4.1 ParallelResultViewに音声キャッシュを追加

```typescript
function ParallelResultView({ response, agent, onStartListening, isListening, question }: ResultViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pairs, setPairs] = useState<SentenceImagePair[]>(response.pairs || []);
  
  // 音声キャッシュ（NEW）
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  
  // 初期化: 最初のペアの音声をキャッシュ
  useEffect(() => {
    const firstPair = pairs[0];
    if (firstPair?.audioData && !audioCache.current.has(firstPair.id)) {
      const audioUrl = `data:audio/wav;base64,${firstPair.audioData}`;
      const audio = new Audio(audioUrl);
      audioCache.current.set(firstPair.id, audio);
      console.log(`[DEBUG] First pair audio cached`);
    }
  }, []);
  
  // バックグラウンド画像生成（既存）
  useBackgroundImageGenerator(pairs, (pairId, imageUrl, status) => {
    setPairs(prev => prev.map(p =>
      p.id === pairId
        ? { ...p, imageUrl, status, generatedAt: new Date() }
        : p
    ));
  });
  
  // バックグラウンド音声生成（NEW）
  useBackgroundAudioGenerator(pairs, (pairId, audioData) => {
    setPairs(prev => prev.map(p =>
      p.id === pairId ? { ...p, audioData } : p
    ));
    
    // 音声データをキャッシュ
    if (audioData) {
      const audioUrl = `data:audio/wav;base64,${audioData}`;
      const audio = new Audio(audioUrl);
      audioCache.current.set(pairId, audio);
      console.log(`[DEBUG] Audio cached for ${pairId}`);
    }
  });
  
  // ペア変更時に音声再生
  useEffect(() => {
    const currentPair = pairs[currentIndex];
    if (!currentPair) return;
    
    // キャッシュから音声を取得
    const cachedAudio = audioCache.current.get(currentPair.id);
    
    if (cachedAudio) {
      // ⚡ キャッシュがあれば即座に再生（レイテンシー: 0ms）
      cachedAudio.currentTime = 0; // 最初から再生
      cachedAudio.play().catch(err => {
        console.error('Audio playback error:', err);
      });
      
      cachedAudio.onended = () => {
        if (!isLast) {
          setCurrentIndex(prev => prev + 1);
        }
      };
    } else if (currentPair.audioData) {
      // キャッシュにないが音声データがある場合
      const audioUrl = `data:audio/wav;base64,${currentPair.audioData}`;
      const audio = new Audio(audioUrl);
      audioCache.current.set(currentPair.id, audio);
      audio.play();
    } else {
      // 音声データがまだ生成されていない場合
      console.warn(`[WARN] Audio not ready for ${currentPair.id}, waiting...`);
      // フォールバック: Web Speech APIを使用
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(currentPair.text);
        utterance.lang = 'ja-JP';
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [currentIndex]);
  
  // ... 残りのコード ...
}
```

---

## タイムライン比較

### 現在の実装（全音声を事前生成する場合）

```
0秒    エージェント選択開始
1秒    説明文生成開始
3秒    ペア配列作成
3秒    画像1生成開始
5秒    画像1完了
5秒    音声1生成開始
6秒    音声1完了
6秒    音声2生成開始
7秒    音声2完了
7秒    音声3生成開始
8秒    音声3完了
8秒    音声4生成開始
9秒    音声4完了
9秒    ⚡ レスポンス返却（ユーザーが見られる）
```

**ユーザー待ち時間: 9秒**

---

### 提案された実装（Progressive Loading）

```
0秒    エージェント選択開始
1秒    説明文生成開始
3秒    ペア配列作成
3秒    画像1と音声1を並列生成開始
5秒    画像1完了、音声1完了
5秒    ⚡ レスポンス返却（ユーザーが見られる）
       ↓
       [ユーザーは最初のペアを見ている]
       ↓
5秒    音声2生成開始（バックグラウンド）
6秒    音声2完了
6秒    音声3生成開始（バックグラウンド）
7秒    音声3完了
7秒    音声4生成開始（バックグラウンド）
8秒    音声4完了
```

**ユーザー待ち時間: 5秒（44%削減）**

**ユーザーが2番目のペアに進む頃（約10秒後）には全音声が準備完了**

---

## 実装の優先順位

### 🔴 Phase 1: 最小限の実装（2-3時間）
1. ✅ 型定義の更新（audioData追加）
2. ✅ actions.tsで最初のペアの音声生成
3. ✅ ResultViewで音声キャッシュの基本実装

**効果**: 待ち時間 9秒 → 5秒

---

### 🟡 Phase 2: バックグラウンド生成（2-3時間）
4. ✅ useBackgroundAudioGenerator.ts作成
5. ✅ ResultViewに統合
6. ✅ エラーハンドリング

**効果**: 2番目以降のペアも即座に再生可能

---

### 🟢 Phase 3: 最適化（1-2時間）
7. ✅ プリフェッチ機能（次のペアを先読み）
8. ✅ メモリ管理（使用済み音声の解放）
9. ✅ ローディング状態の表示

**効果**: UXのさらなる向上

---

## リスクと対策

### リスク1: 音声がまだ生成されていない状態でユーザーが次に進む
**対策**:
- Web Speech APIでフォールバック
- ローディング表示（「音声を準備中...」）
- 「次へ」ボタンを一時的に無効化

### リスク2: 並列生成によるレート制限
**対策**:
- 音声生成は画像生成より軽い（レート制限の心配は少ない）
- 必要に応じて順次生成に変更可能

### リスク3: メモリ使用量の増加
**対策**:
- 音声データは比較的小さい（50-100KB/ペア）
- 使用済みの音声は解放
- 最大5ペア程度なら問題なし

---

## まとめ

### ✅ 実装可能性
**完全に実装可能**。既存のuseBackgroundImageGeneratorと同じパターンを使用。

### 🎯 期待効果
- **待ち時間**: 9秒 → 5秒（**44%削減**）
- **体感速度**: 大幅に改善（即座にコンテンツが表示される）
- **UX**: ユーザーは待たされている感覚がなくなる

### 📊 実装難易度
- **難易度**: 中
- **工数**: 5-8時間
- **リスク**: 低（既存パターンの応用）

### 🚀 推奨
**強く推奨**。UX改善効果が非常に高く、実装も現実的。
