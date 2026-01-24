# Phase Next: ローディングアニメーション強化

**作成日**: 2026-01-07  
**ステータス**: 計画中  
**優先度**: ⭐⭐⭐（高）  
**実装時間**: 1-2時間  
**前提**: Phase 9.3完了

## 📋 背景

Phase 9.3の分析により、Gemini API処理時間（40秒）は制御不可能であることが判明しました。
そのため、**体感速度の改善**にフォーカスする戦略に転換します。

### Phase 9.3の知見

- ✅ 真のボトルネック: Gemini API処理時間が95%（40秒）
- ❌ 画像サイズ削減: 効果なし（データ転送は5%のみ）
- ✅ 並列処理: 最も効果的（24%短縮）
- ✅ APIパラメータ最適化: 約5%改善

## 🎯 目標

**待ち時間を感じさせない**ローディング体験の実現

### 定量的目標

- 体感速度: 42秒 → 5秒以内（**88%改善**）
- 実装時間: 1-2時間
- コスト増加: ゼロ

### 定性的目標

- ユーザーが待ち時間を楽しめる
- 選択した巨匠のスタイルを視覚的に伝える
- プロフェッショナルな印象

## 💡 実装アイデア

### 基本コンセプト

**既存の巨匠イメージ画像を活用したアニメーション**

現在、各巨匠には専用のイメージ画像が用意されています。
これを生成中に表示し、CSSアニメーションで動かすことで、待ち時間を楽しい体験に変えます。

### 実装方法

```typescript
// 生成中の表示フロー
1. 生成開始 → 選択した巨匠のイメージ画像を表示
2. CSSアニメーション開始（42秒間）
3. 完成時 → 実際の生成画像にスムーズに切り替え
```

### CSSアニメーション案

#### 案1: Ken Burns効果（推奨）⭐

映画的なゆっくりズーム＆パン

```css
@keyframes kenBurns {
  0% {
    transform: scale(1) translate(0, 0);
    opacity: 0.7;
    filter: blur(2px);
  }
  50% {
    transform: scale(1.2) translate(-5%, -5%);
    opacity: 0.9;
    filter: blur(1px);
  }
  100% {
    transform: scale(1.1) translate(-3%, -3%);
    opacity: 1;
    filter: blur(0.5px);
  }
}

.artist-preview {
  animation: kenBurns 42s ease-in-out;
  transition: all 1s ease-out;
}
```

**特徴**:
- ✅ 映画的で高級感がある
- ✅ 動きが滑らか
- ✅ 巨匠の作品を鑑賞する感覚

#### 案2: パルスエフェクト

リズミカルな拡大縮小

```css
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
}

.artist-preview {
  animation: pulse 3s ease-in-out infinite;
}
```

**特徴**:
- ✅ リズミカルで活気がある
- ✅ 「生成中」を強調
- ⚠️ 長時間だと疲れる可能性

#### 案3: 回転＋ズーム

ダイナミックな動き

```css
@keyframes rotateZoom {
  0% {
    transform: scale(1) rotate(0deg);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.3) rotate(5deg);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.1) rotate(0deg);
    opacity: 1;
  }
}

.artist-preview {
  animation: rotateZoom 42s ease-in-out;
}
```

**特徴**:
- ✅ ダイナミックで印象的
- ⚠️ 回転が強すぎると不自然

#### 案4: パーティクルエフェクト

画像の周りにキラキラ

```css
@keyframes sparkle {
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(255, 215, 0, 0.6);
  }
}

.artist-preview {
  animation: sparkle 2s ease-in-out infinite;
}
```

**特徴**:
- ✅ 華やかで楽しい
- ✅ 「生成中」を強調
- ⚠️ 派手すぎる可能性

### 推奨実装

**Ken Burns効果 + 進捗表示**

```tsx
<div className="loading-container">
  <img 
    src={selectedArtist.imageUrl} 
    alt={selectedArtist.name}
    className="artist-preview ken-burns"
  />
  <div className="loading-overlay">
    <h2>{selectedArtist.name}のスタイルで生成中...</h2>
    <ProgressBar duration={42} />
    <p className="tip">
      {selectedArtist.name}は{selectedArtist.era}を代表する巨匠です
    </p>
  </div>
</div>
```

## 🎨 UI/UX設計

### レイアウト

```
┌─────────────────────────────────┐
│                                 │
│   [巨匠イメージ画像]            │
│   （Ken Burnsアニメーション）    │
│                                 │
│   ┌─────────────────────┐      │
│   │ 葛飾北斎のスタイルで │      │
│   │ 生成中...            │      │
│   │ ▓▓▓▓▓▓▓░░░░ 60%    │      │
│   │                      │      │
│   │ 葛飾北斎は江戸時代を │      │
│   │ 代表する浮世絵師です │      │
│   └─────────────────────┘      │
│                                 │
└─────────────────────────────────┘
```

### 情報表示

1. **巨匠名**: 「〇〇のスタイルで生成中...」
2. **進捗バー**: 視覚的なフィードバック
3. **豆知識**: 巨匠の簡単な紹介（待ち時間を楽しませる）

### 切り替えアニメーション

```css
/* 完成時のスムーズな切り替え */
@keyframes fadeTransition {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.transition-to-final {
  animation: fadeTransition 1s ease-in-out;
}
```

## 📊 期待される効果

### 定量的効果

- **体感速度**: 42秒 → 5秒以内（**88%改善**）
  - 理由: 即座に視覚的フィードバックが得られる
- **離脱率**: 推定30%削減
  - 理由: 待ち時間が楽しくなる

### 定性的効果

- ✅ プロフェッショナルな印象
- ✅ 巨匠のスタイルを視覚的に伝える
- ✅ 待ち時間が楽しい体験になる
- ✅ ユーザーエンゲージメント向上

## 🛠️ 実装計画

### Phase 1: 基本実装（1時間）

1. ✅ 巨匠イメージ画像の表示
2. ✅ Ken Burnsアニメーションの実装
3. ✅ 進捗バーの追加

### Phase 2: 情報表示（30分）

1. ✅ 巨匠名の表示
2. ✅ 豆知識の表示
3. ✅ 進捗パーセンテージの表示

### Phase 3: 切り替えアニメーション（30分）

1. ✅ 完成時のフェードアニメーション
2. ✅ スムーズな画像切り替え

## 📝 実装の注意点

### パフォーマンス

- ✅ CSSアニメーションのみ（GPU加速）
- ✅ JavaScriptの負荷なし
- ✅ 既存アセットの活用（新規画像生成不要）

### アクセシビリティ

- ✅ `prefers-reduced-motion`への対応
- ✅ スクリーンリーダー対応
- ✅ キーボード操作対応

### ブラウザ互換性

- ✅ モダンブラウザ対応（Chrome, Firefox, Safari, Edge）
- ✅ CSSアニメーションのフォールバック

## 🎯 成功指標

### 定量的指標

- 体感速度: 5秒以内
- 離脱率: 30%削減
- ユーザー満足度: 4.5/5以上

### 定性的指標

- ユーザーフィードバック: 「待ち時間が楽しい」
- プロフェッショナルな印象
- 巨匠のスタイルが伝わる

## 📚 参考資料

- [Phase 9.3完了報告](../done/phase9.3-performance-improvement-completion.md)
- [今後のパフォーマンス改善戦略](../future-performance-strategy.md)
- [Phase 3-1実験レポート](../done/phase9.3-phase3-1-experiment-report.md)

## 🔗 関連Phase

- **Phase 9.3**: パフォーマンス改善とボトルネック分析（完了）
- **Phase Next+1**: ローカルストレージキャッシュ（計画中）
- **Phase Next+2**: プリジェネレーション（計画中）

## 🎯 次のステップ

### 即座に実施（Codeモード）

1. ✅ Ken Burnsアニメーションの実装
2. ✅ 進捗バーの追加
3. ✅ 巨匠情報の表示

### 検証項目

1. ✅ アニメーションの滑らかさ
2. ✅ 体感速度の改善
3. ✅ ユーザーフィードバック

---

**最終更新**: 2026-01-07  
**次のアクション**: Codeモードで実装開始
