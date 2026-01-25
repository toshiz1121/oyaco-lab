# 音声とテキスト表示の同期改善 - 実装完了

## 実装内容

### 1. [`src/hooks/useTextToSpeech.ts`](src/hooks/useTextToSpeech.ts)
**変更点:**
- `loadAudio(text: string): Promise<LoadedAudio>` 関数を追加
  - 音声データを事前に取得し、`Audio`オブジェクト、`duration`、`play()`関数を返す
  - 音声のメタデータをロードして正確な再生時間を取得
- `isPreparing` 状態を追加（ロード中の表示用）
- `LoadedAudio` 型をエクスポート

**効果:**
- 音声の「ロード」と「再生」を分離し、事前準備が可能に
- 音声の長さを事前に取得できるため、テキスト表示速度の計算が可能に

### 2. [`src/components/StreamingText.tsx`](src/components/StreamingText.tsx)
**変更点:**
- `isActive?: boolean` プロップを追加
  - `false`の間は表示を待機、`true`になった瞬間にアニメーション開始
- `totalDuration?: number` プロップを追加
  - 指定された場合、`speed = totalDuration / text.length`で速度を自動計算
  - 最小20ms/char、最大200ms/charに制限して自然な表示速度を維持

**効果:**
- 音声再生開始と同時にテキスト表示を開始可能
- 音声の長さに合わせて自動的にテキスト表示速度を調整

### 3. [`src/components/ResultView.tsx`](src/components/ResultView.tsx)
**変更点:**
- 状態管理を追加:
  - `isTextActive`: テキストアニメーション開始フラグ
  - `audioDuration`: 音声の再生時間
  - `isLoading`: 音声ロード中フラグ
- `audioCache: Map<number, LoadedAudio>` でステップごとの音声をキャッシュ
- `playStep`を`async`関数に変更:
  1. キャッシュから音声を取得、なければ`loadAudio`でロード
  2. 次のステップの音声をバックグラウンドでプリフェッチ
  3. ロード完了後、`isTextActive=true`と`loadedAudio.play()`を同時実行
- ローディング状態の表示を追加

**効果:**
- 音声のロード完了を待ってから、音声とテキストを同時に開始
- 2ステップ目以降は事前ロードにより待ち時間なし
- ユーザーに音声準備中であることを明示

## 動作フロー

```
1. ステップ開始
   ↓
2. 音声をロード（キャッシュにない場合）
   ↓（ローディング表示）
3. ロード完了
   ↓
4. 音声の duration を取得
   ↓
5. isTextActive=true に設定
   + 音声再生開始
   + テキスト表示開始（duration に基づく速度で）
   ↓
6. （同時進行）次のステップの音声を事前ロード
   ↓
7. 音声終了
   ↓
8. 次のステップへ（キャッシュ済みなので即座に開始）
```

## 期待される効果

✅ **同期開始**: 音声が鳴り始めた瞬間に文字が書き始める  
✅ **同期終了**: 音声が終わるタイミングでちょうど文字も出し切る  
✅ **待ち時間削減**: 2ステップ目以降は事前ロードにより待ち時間なし  
✅ **ユーザー体験向上**: ローディング状態の表示により、何が起きているか明確に

## 技術的な工夫

1. **音声の長さに基づく速度計算**
   - `speed = totalDuration / text.length`
   - 最小20ms、最大200msに制限して自然な表示速度を維持

2. **プリフェッチ戦略**
   - 現在のステップ再生中に次のステップを非同期ロード
   - キャッシュを使って重複ロードを防止

3. **エラーハンドリング**
   - 音声ロード失敗時もテキストは表示
   - ユーザーに状態を明示（ローディング、再生中など）
