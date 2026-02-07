# ステップ3音声生成時のローディング表示実装計画

## 📋 概要

現在、ステップ3（最初のペアの画像と音声の並列生成）で音声生成を待つ時間がありますが、ユーザーへのフィードバックがありません。この実装では、音声生成中にローディング表示とリアクションを追加し、ユーザー体験を向上させます。

## 🎯 目標

- 音声生成中であることをユーザーに明確に伝える
- 待機時間を退屈させない視覚的なフィードバックを提供
- 画像生成と音声生成の進捗を分けて表示

## 📊 現状分析

### 現在の処理フロー

```
useAgentChat.ts:
1. エキスパート選定 → viewMode: 'selecting'
2. スポットライト表示 → viewMode: 'selecting'
3. スポットライト完了 → viewMode: 'imageGenerating'
4. 画像・音声生成（並列） → viewMode: 'imageGenerating'
5. 生成完了 → viewMode: 'result'
```

### 問題点

1. **音声生成の可視性がない**
   - `ImageGeneratingView`は画像生成のみを表示
   - 音声生成の進捗が見えない
   - ユーザーは何が起きているか分からない

2. **待機時間のフィードバック不足**
   - 音声生成は1-3秒かかる可能性がある
   - この間、ユーザーは待たされている感覚を持つ

3. **進捗の不透明性**
   - `generationProgress`は画像生成のみを反映
   - 音声生成の状態が追跡されていない

## 🎨 設計方針

### アプローチ1: ImageGeneratingViewを拡張（推奨）

**メリット:**
- 既存のUIフローを維持
- 実装が比較的シンプル
- 画像と音声の生成を統合的に表示

**実装内容:**
- `ImageGeneratingView`に音声生成ステータスを追加
- プログレスバーを2段階に分割（画像 + 音声）
- 音声生成中のアニメーション追加

### アプローチ2: 新しいビューモードを追加

**メリット:**
- 画像と音声の生成を明確に分離
- より詳細なフィードバックが可能

**デメリット:**
- 実装が複雑
- ビューの切り替えが増える
- ユーザー体験が断片的になる可能性

## 🔧 実装計画（アプローチ1を採用）

### Phase 1: 状態管理の拡張

#### 1.1 useAgentChatに音声生成状態を追加

```typescript
// src/hooks/useAgentChat.ts

// 新しい状態を追加
const [isAudioGenerating, setIsAudioGenerating] = useState(false);
const [audioProgress, setAudioProgress] = useState(0);

// handleQuestion内で音声生成の進捗を追跡
const handleQuestion = async (question: string) => {
  // ... 既存のコード ...
  
  // 音声生成開始
  setIsAudioGenerating(true);
  setAudioProgress(0);
  
  // 音声生成の進捗シミュレーション
  const audioProgressInterval = setInterval(() => {
    setAudioProgress(prev => Math.min(prev + 10, 90));
  }, 200);
  
  try {
    // ... 既存の生成処理 ...
    
    // 音声生成完了
    setAudioProgress(100);
    setIsAudioGenerating(false);
  } finally {
    clearInterval(audioProgressInterval);
  }
};
```

#### 1.2 ViewRendererに新しいpropsを追加

```typescript
// src/components/AgentChatInterface/ViewRenderer.tsx

interface ViewRendererProps {
  // ... 既存のprops ...
  isAudioGenerating: boolean;
  audioProgress: number;
}
```

### Phase 2: ImageGeneratingViewの拡張

#### 2.1 音声生成ステータスの表示

```typescript
// src/components/ImageGeneratingView.tsx

interface ImageGeneratingViewProps {
  agent: Agent;
  question: string;
  progress: number;
  isAudioGenerating?: boolean;  // 新規追加
  audioProgress?: number;        // 新規追加
}

export function ImageGeneratingView({
  agent,
  question,
  progress,
  isAudioGenerating = false,
  audioProgress = 0
}: ImageGeneratingViewProps) {
  // 全体の進捗を計算（画像70% + 音声30%）
  const totalProgress = isAudioGenerating 
    ? (progress * 0.7) + (audioProgress * 0.3)
    : progress;
  
  return (
    <div className="...">
      {/* 既存の画像生成UI */}
      
      {/* 音声生成ステータス */}
      {isAudioGenerating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              🎵
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-600 mb-2">
                こえをつくっているよ...
              </p>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${audioProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
```

#### 2.2 視覚的なフィードバックの強化

```typescript
// 音声生成中のアニメーション
{isAudioGenerating && (
  <div className="absolute top-4 right-4">
    <motion.div
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.5, 1, 0.5]
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className="text-4xl"
    >
      🎤
    </motion.div>
  </div>
)}
```

### Phase 3: 進捗バーの改善

#### 3.1 2段階プログレスバー

```typescript
// 画像生成と音声生成を分けて表示
<div className="space-y-4">
  {/* 画像生成プログレス */}
  <div>
    <div className="flex justify-between mb-2">
      <span className="text-sm font-bold">🎨 えをかいているよ</span>
      <span className="text-sm">{Math.round(progress)}%</span>
    </div>
    <ProgressBar value={progress} />
  </div>
  
  {/* 音声生成プログレス */}
  {isAudioGenerating && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
    >
      <div className="flex justify-between mb-2">
        <span className="text-sm font-bold">🎵 こえをつくっているよ</span>
        <span className="text-sm">{Math.round(audioProgress)}%</span>
      </div>
      <ProgressBar value={audioProgress} color="green" />
    </motion.div>
  )}
</div>
```

### Phase 4: actions.tsの修正

#### 4.1 音声生成の進捗を追跡可能にする

現在の実装では、`Promise.all`で並列実行しているため、個別の進捗が取れません。
以下の2つのオプションがあります：

**オプションA: 現状維持（推奨）**
- `Promise.all`のまま
- クライアント側で進捗をシミュレート
- 実装がシンプル

**オプションB: 逐次実行に変更**
- 画像生成 → 音声生成の順に実行
- 各ステップの進捗を正確に追跡
- 全体の処理時間が若干増加

推奨は**オプションA**です。音声生成は通常1-2秒で完了するため、シミュレーションで十分です。

## 📝 実装手順

### ステップ1: useAgentChatの拡張
1. `isAudioGenerating`と`audioProgress`の状態を追加
2. `handleQuestion`内で音声生成の進捗をシミュレート
3. 戻り値に新しい状態を追加

### ステップ2: ViewRendererの更新
1. 新しいpropsを追加
2. `ImageGeneratingView`に渡す

### ステップ3: ImageGeneratingViewの拡張
1. 音声生成ステータスのUIを追加
2. アニメーションを実装
3. 2段階プログレスバーを実装

### ステップ4: テストと調整
1. 音声生成の進捗表示を確認
2. アニメーションの滑らかさを調整
3. タイミングの微調整

## 🎨 UIデザイン案

### 音声生成中の表示

```
┌─────────────────────────────────────┐
│  🎨 えをかいているよ...        85% │
│  ████████████████░░░░░░░░░░░░░░░░  │
│                                     │
│  🎵 こえをつくっているよ...    45% │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                     │
│  [博士のアバター + アニメーション]   │
│                                     │
│  「もうすこしまってね！」           │
└─────────────────────────────────────┘
```

### アニメーション案

1. **音符が浮かぶ**: 🎵 🎶 が画面を漂う
2. **マイクが光る**: 🎤 が点滅
3. **音波エフェクト**: 波紋が広がるアニメーション
4. **博士が話す**: 口が動くアニメーション（オプション）

## 🔍 考慮事項

### パフォーマンス
- アニメーションは軽量に保つ
- 進捗更新の頻度を適切に設定（200-300ms間隔）

### アクセシビリティ
- 音声生成中であることをテキストで明示
- 色だけに依存しない（アイコンも使用）

### エラーハンドリング
- 音声生成が失敗した場合の表示
- タイムアウト時の処理

## 📊 期待される効果

1. **ユーザー体験の向上**
   - 待機時間が明確になる
   - 何が起きているか理解できる

2. **不安の軽減**
   - 進捗が見えることで安心感
   - フリーズしていないことが分かる

3. **エンゲージメント向上**
   - アニメーションで楽しさを追加
   - 子供が飽きない工夫

## 🚀 次のステップ

1. この計画をレビュー
2. ステップ1から順に実装
3. 各ステップでテスト
4. 必要に応じて調整

## 📌 備考

- 音声生成は通常1-3秒で完了
- 画像生成の方が時間がかかる（3-5秒）
- 全体の処理時間は5-8秒程度
