# ViewMode遷移バグの修正記録

## 📋 概要

質問送信後に結果画面に遷移せず、博士選択画面に戻ってしまう問題と、結果画面に遷移した後に同じ質問が再送信される問題を解決した記録です。

**発生日**: 2025年2月7日  
**影響範囲**: `useAgentChat.ts`, `AgentChatInterface/index.tsx`  
**重要度**: 高（ユーザー体験に直接影響）

---

## 🔴 問題1: 結果画面に遷移しない

### 症状

質問を送信した後、以下のような動作になっていた：

1. 質問送信
2. 博士選択画面（スポットライト）表示
3. 回答生成完了
4. **博士選択画面に戻る** ← 本来は結果画面に遷移すべき

### 原因分析

#### 問題のコード

```typescript
// useAgentChat.ts
useEffect(() => {
  if (viewMode === 'imageGenerating' && isApiComplete && latestResponse) {
    const timer = setTimeout(() => {
      setViewMode('result');
    }, 800);
    return () => clearTimeout(timer);
  }
}, [viewMode, isApiComplete, latestResponse]);
```

#### 処理フローの問題

```
1. handleQuestion実行
2. setViewMode('selecting')  ← 博士選択画面
3. エキスパート選定完了
4. if (newExpert === prevExpert) {
     setViewMode('imageGenerating');  ← 同じ博士の場合のみ
   }
5. 異なる博士の場合、viewModeは'selecting'のまま ← ここが問題！
6. 回答生成開始（並行処理）
7. 回答生成完了 → isApiComplete=true, latestResponse設定
8. useEffect発火
   → if (viewMode === 'imageGenerating' && ...) 
   → viewMode='selecting'なので条件を満たさない
   → 結果画面に遷移しない！
```

#### 根本原因

**異なる博士が選ばれた場合、`viewMode` が 'selecting' のまま放置され、結果画面への遷移条件 `viewMode === 'imageGenerating'` を満たさない。**

### 解決策

**`viewMode` の条件を削除し、生成完了したら無条件で結果画面に遷移する。**

```typescript
// 修正後
useEffect(() => {
  if (isApiComplete && latestResponse) {
    console.log('[useAgentChat] 生成完了 → 結果画面に遷移');
    const timer = setTimeout(() => {
      setViewMode('result');
    }, 500);
    return () => clearTimeout(timer);
  }
}, [isApiComplete, latestResponse]);  // viewModeを依存配列から削除
```

#### 修正のポイント

1. **`viewMode === 'imageGenerating'` の条件を削除**
   - どの画面にいても、生成完了したら結果画面へ遷移

2. **依存配列から `viewMode` を削除**
   - `viewMode` が変更されてもuseEffectが再実行されない
   - 無限ループを防ぐ

3. **遅延時間を800ms → 500msに短縮**
   - よりスムーズな遷移

---

## 🔴 問題2: 同じ質問が再送信される

### 症状

結果画面に遷移した直後、同じ質問が自動的に再送信されていた：

```
[useAgentChat] 生成完了 → 結果画面に遷移
[ConversationLogger] Successfully logged: conv_xxx
[useAgentChat] フェーズ1: エージェント選定中...  ← また質問処理が始まる！
```

### 原因分析

#### 問題のコード

```typescript
// AgentChatInterface/index.tsx
useEffect(() => {
  const canSubmit = !isListening && 
                    transcript.trim().length > 0 && 
                    (viewMode === 'input' || viewMode === 'result');
  
  if (canSubmit) {
    handleQuestion(transcript);
  }
}, [isListening, transcript, viewMode]);  // ← viewModeが依存配列に入っている
```

#### 処理フローの問題

```
1. 音声認識で質問を送信
2. transcript = "どうして空は青いの？"
3. handleQuestion(transcript) 実行
4. 回答生成完了
5. viewMode = 'result' に変更  ← ここでuseEffectが再実行される！
6. useEffect発火（viewModeの変更）
7. canSubmit = true になる
   - !isListening = true
   - transcript.trim().length > 0 = true（前回のtranscriptが残っている）
   - viewMode === 'result' = true
8. handleQuestion(transcript) が再度呼ばれる ← 同じ質問が再送信！
```

#### 根本原因

**`viewMode` が依存配列に含まれているため、画面遷移のたびにuseEffectが再実行され、`transcript` が残っていると再送信される。**

### 解決策

**`viewMode` を依存配列から削除し、音声認識の状態変化のみで実行されるようにする。**

```typescript
// 修正後
useEffect(() => {
  const canSubmit = !isListening && 
                    transcript.trim().length > 0 && 
                    (viewMode === 'input' || viewMode === 'result');
  
  if (canSubmit) {
    handleQuestion(transcript);
    resetTranscript();  // 送信後にtranscriptをリセット
  }
  // viewModeは依存配列に含めない（画面遷移で再実行されるのを防ぐ）
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isListening, transcript]);
```

#### 修正のポイント

1. **依存配列から `viewMode` を削除**
   - 画面遷移でuseEffectが再実行されない
   - 音声認識の状態変化（`isListening`, `transcript`）のみで実行

2. **`resetTranscript()` を追加**
   - 送信後に `transcript` をクリア
   - 次回の音声認識に影響しない

3. **ESLint警告を抑制**
   - `viewMode` を依存配列に含めないのは意図的な設計
   - `// eslint-disable-next-line react-hooks/exhaustive-deps` で警告を抑制

---

## 🎯 useEffectの依存配列の設計原則

今回の問題から学んだ、useEffectの依存配列の設計原則：

### 原則1: トリガーと条件を区別する

```typescript
useEffect(() => {
  // トリガー: このuseEffectを実行するきっかけ
  // 条件: 実行するかどうかの判定
  
  if (条件A && 条件B) {
    // 処理
  }
}, [トリガーのみを依存配列に含める]);
```

### 原則2: 状態変更を引き起こす値を依存配列に含めない

```typescript
// ❌ 悪い例
useEffect(() => {
  if (isComplete) {
    setViewMode('result');  // viewModeを変更
  }
}, [isComplete, viewMode]);  // viewModeが依存配列に入っている
// → viewModeが変更されると再実行 → 無限ループの可能性

// ✅ 良い例
useEffect(() => {
  if (isComplete) {
    setViewMode('result');
  }
}, [isComplete]);  // トリガーのみ
```

### 原則3: 条件チェックのみに使う値は依存配列に含めない

```typescript
// ❌ 悪い例
useEffect(() => {
  if (viewMode === 'input' && transcript) {
    handleSubmit(transcript);
  }
}, [viewMode, transcript]);  // viewModeの変更で再実行される

// ✅ 良い例
useEffect(() => {
  if (viewMode === 'input' && transcript) {
    handleSubmit(transcript);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [transcript]);  // transcriptの変更のみで実行
```

---

## 📊 修正前後の比較

### 問題1: 結果画面への遷移

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| 遷移条件 | `viewMode === 'imageGenerating'` | `isApiComplete && latestResponse` |
| 依存配列 | `[viewMode, isApiComplete, latestResponse]` | `[isApiComplete, latestResponse]` |
| 異なる博士の場合 | 遷移しない ❌ | 正常に遷移 ✅ |
| 同じ博士の場合 | 正常に遷移 ✅ | 正常に遷移 ✅ |

### 問題2: 質問の再送信

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| トリガー | 音声認識 + 画面遷移 | 音声認識のみ |
| 依存配列 | `[isListening, transcript, viewMode]` | `[isListening, transcript]` |
| 結果画面遷移時 | 再送信される ❌ | 再送信されない ✅ |
| transcript処理 | クリアされない | 送信後にクリア ✅ |

---

## 🧪 テストケース

### テストケース1: 異なる博士が選ばれた場合

```
1. 質問送信: "どうして空は青いの？"
2. 博士選定: scientist（前回と異なる）
3. スポットライト表示（3.5秒）
4. 回答生成開始
5. 回答生成完了
6. 結果画面に遷移 ✅
```

### テストケース2: 同じ博士が選ばれた場合

```
1. 質問送信: "雲はどうやってできるの？"
2. 博士選定: scientist（前回と同じ）
3. スポットライトスキップ
4. 回答生成開始
5. 回答生成完了
6. 結果画面に遷移 ✅
```

### テストケース3: 音声認識での質問送信

```
1. マイクボタンクリック
2. 音声認識開始
3. "どうして空は青いの？" と発話
4. 音声認識停止
5. 質問送信 ✅
6. 回答生成完了
7. 結果画面に遷移
8. 同じ質問が再送信されない ✅
```

### テストケース4: 結果画面での再質問

```
1. 結果画面表示中
2. マイクボタンクリック
3. 音声認識開始
4. "雲はどうやってできるの？" と発話
5. 音声認識停止
6. 新しい質問が送信される ✅
7. 前回の質問は送信されない ✅
```

---

## 🔧 修正ファイル

### 1. `src/hooks/useAgentChat.ts`

**変更箇所**: 結果画面への自動遷移ロジック

```typescript
// 修正前
useEffect(() => {
  if (viewMode === 'imageGenerating' && isApiComplete && latestResponse) {
    const timer = setTimeout(() => {
      setViewMode('result');
    }, 800);
    return () => clearTimeout(timer);
  }
}, [viewMode, isApiComplete, latestResponse]);

// 修正後
useEffect(() => {
  if (isApiComplete && latestResponse) {
    console.log('[useAgentChat] 生成完了 → 結果画面に遷移');
    const timer = setTimeout(() => {
      setViewMode('result');
    }, 500);
    return () => clearTimeout(timer);
  }
}, [isApiComplete, latestResponse]);
```

### 2. `src/components/AgentChatInterface/index.tsx`

**変更箇所**: 音声認識完了時の自動送信ロジック

```typescript
// 修正前
useEffect(() => {
  const canSubmit = !isListening && 
                    transcript.trim().length > 0 && 
                    (viewMode === 'input' || viewMode === 'result');
  
  if (canSubmit) {
    handleQuestion(transcript);
  }
}, [isListening, transcript, viewMode]);

// 修正後
useEffect(() => {
  const canSubmit = !isListening && 
                    transcript.trim().length > 0 && 
                    (viewMode === 'input' || viewMode === 'result');
  
  if (canSubmit) {
    handleQuestion(transcript);
    resetTranscript();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isListening, transcript]);
```

---

## 💡 学んだこと

### 1. useEffectの依存配列は慎重に設計する

- **トリガー**（実行のきっかけ）と**条件**（実行の判定）を明確に区別
- 条件チェックのみに使う値は依存配列に含めない
- 状態変更を引き起こす値を依存配列に含めると無限ループのリスク

### 2. 状態管理の複雑さを減らす

- 複数の状態が絡み合うと、予期しない動作が発生しやすい
- シンプルな条件で状態遷移を管理する
- デバッグログを適切に配置して、状態遷移を追跡しやすくする

### 3. 副作用のクリーンアップを忘れない

- `resetTranscript()` のように、処理後に状態をクリアする
- 次回の処理に影響を与えないようにする
- メモリリークや予期しない動作を防ぐ

### 4. ESLintの警告を無視する場合は理由を明記

- `// eslint-disable-next-line` を使う場合は、コメントで理由を説明
- 意図的な設計であることを明確にする
- 将来のメンテナンスで混乱を防ぐ

---

## 🚀 今後の改善案

### 1. 状態管理ライブラリの導入

複雑な状態遷移を管理するために、状態管理ライブラリ（Zustand, Jotaiなど）の導入を検討。

### 2. 状態遷移図の作成

viewModeの遷移を視覚化した図を作成し、ドキュメント化する。

### 3. E2Eテストの追加

Playwrightなどを使って、画面遷移のE2Eテストを追加する。

### 4. TypeScriptの型安全性を強化

viewModeの遷移を型レベルで制約し、不正な遷移を防ぐ。

```typescript
type ViewModeTransition = {
  input: 'selecting';
  selecting: 'imageGenerating';
  imageGenerating: 'result';
  result: 'input' | 'selecting';
};
```

---

## 📚 参考資料

- [React useEffect完全ガイド](https://overreacted.io/a-complete-guide-to-useeffect/)
- [useEffectの依存配列の落とし穴](https://react.dev/learn/removing-effect-dependencies)
- [React Hooksのベストプラクティス](https://react.dev/reference/react/hooks)

---

## ✅ チェックリスト

修正後、以下を確認：

- [x] 異なる博士が選ばれた場合、結果画面に正常に遷移する
- [x] 同じ博士が選ばれた場合、結果画面に正常に遷移する
- [x] 音声認識で質問を送信できる
- [x] 結果画面に遷移した後、同じ質問が再送信されない
- [x] 結果画面で新しい質問を送信できる
- [x] コンソールエラーが発生しない
- [x] ESLint警告が適切に抑制されている

---

## 📝 まとめ

今回の問題は、**useEffectの依存配列の設計ミス**が原因でした。

**重要なポイント**:
1. トリガーと条件を明確に区別する
2. 状態変更を引き起こす値を依存配列に含めない
3. 副作用のクリーンアップを忘れない
4. デバッグログで状態遷移を追跡する

これらの原則を守ることで、予期しない動作を防ぎ、保守性の高いコードを書くことができます。

**作成日**: 2025年2月7日  
**作成者**: AI Assistant  
**レビュー**: 必要に応じて更新
