# 並列センテンス・画像生成フロー仕様書

## 概要
AIエージェントによる回答生成と画像生成を並列化し、1センテンス＋1枚の絵をセットにして順次表示する新しいフローを実装する。

## 現在のフロー（問題点）
```
質問 → エージェント選択 → 回答全体生成 → 画像1枚生成 → 音声読み上げ → 表示
```

**問題点:**
- すべての処理が完了するまでユーザーは待つ必要がある
- 回答が長い場合、待ち時間が長くなる
- 画像生成が1枚のみで、複数ステップの説明に対応しきれない

## 新しいフロー（提案）
```
質問 → エージェント選択 → 並列処理開始
  ├─ センテンス1生成 → 画像1生成 → 完了
  ├─ センテンス2生成 → 画像2生成 → 完了
  ├─ センテンス3生成 → 画像3生成 → 完了
  └─ センテンス4生成 → 画像4生成 → 完了

表示フロー:
1. センテンス1 + 画像1を表示 → 音声読み上げ
2. 読み上げ完了後、センテンス2 + 画像2を表示 → 音声読み上げ
3. 以降同様に順次表示
```

**メリット:**
- 最初のセンテンスが完成次第、すぐに表示開始できる
- 裏で次のセンテンスと画像を並列生成し、待ち時間を最小化
- ユーザー体験が大幅に向上（待ち時間の体感が短くなる）

## 技術仕様

### 1. データ構造の変更

#### SentenceImagePair（新規）
```typescript
interface SentenceImagePair {
  id: string;                    // ユニークID
  stepNumber: number;            // ステップ番号（1, 2, 3...）
  text: string;                  // センテンス本文（日本語）
  visualDescription: string;     // 画像生成用プロンプト（英語）
  imageUrl?: string;             // 生成された画像のURL
  status: 'pending' | 'generating' | 'ready' | 'error';  // 生成状態
  generatedAt?: Date;            // 生成完了時刻
}
```

#### AgentResponse（更新）
```typescript
interface AgentResponse {
  agentId: AgentRole;
  text: string;                  // 回答全体の要約（従来通り）
  pairs: SentenceImagePair[];    // センテンス＋画像のペア配列（新規）
  selectionReason?: string;
  // 以下は廃止予定
  // steps?: ExplanationStep[];
  // imageUrl?: string;
}
```

### 2. バックエンド処理フロー

#### consultAction（更新）
```typescript
export async function consultAction(
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  
  // 1. エージェント選択（従来通り）
  const { agentId, reason } = await decideAgent(question, history);
  
  // 2. 回答生成（従来通り）
  const responseData = await generateExpertResponse(agentId, question, history, style);
  
  // 3. センテンス＋画像ペアの初期化
  const pairs: SentenceImagePair[] = responseData.steps.map((step, index) => ({
    id: `${Date.now()}-${index}`,
    stepNumber: step.stepNumber,
    text: step.text,
    visualDescription: step.visualDescription,
    status: 'pending'
  }));
  
  // 4. 最初のペアのみ画像生成（即座に表示するため）
  if (pairs.length > 0) {
    pairs[0].status = 'generating';
    const imageUrl = await generateIllustration(pairs[0].visualDescription);
    pairs[0].imageUrl = imageUrl;
    pairs[0].status = imageUrl ? 'ready' : 'error';
    pairs[0].generatedAt = new Date();
  }
  
  return {
    success: true,
    data: {
      agentId,
      text: responseData.text,
      pairs,
      selectionReason: reason
    }
  };
}
```

#### generateNextImageAction（新規）
```typescript
/**
 * 次のセンテンスの画像を生成する
 * クライアントから呼び出される
 */
export async function generateNextImageAction(
  visualDescription: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const imageUrl = await generateIllustration(visualDescription);
    return { 
      success: true, 
      imageUrl 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Image generation failed' 
    };
  }
}
```

### 3. フロントエンド処理フロー

#### AgentChatInterface（更新）
```typescript
export function AgentChatInterface({ initialQuestion, onNewSession }: AgentChatInterfaceProps) {
  const [pairs, setPairs] = useState<SentenceImagePair[]>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  
  const handleQuestion = async (question: string) => {
    // 1. API呼び出し（最初のペアの画像は生成済み）
    const result = await consultAction(question, history, 'default');
    
    if (result.success && result.data) {
      setPairs(result.data.pairs);
      setCurrentPairIndex(0);
      
      // 2. 裏で次のペアの画像生成を開始
      if (result.data.pairs.length > 1) {
        generateNextImagesInBackground(result.data.pairs, 1);
      }
    }
  };
  
  const generateNextImagesInBackground = async (
    allPairs: SentenceImagePair[], 
    startIndex: number
  ) => {
    for (let i = startIndex; i < allPairs.length; i++) {
      const pair = allPairs[i];
      
      // 状態更新: generating
      setPairs(prev => prev.map(p => 
        p.id === pair.id ? { ...p, status: 'generating' } : p
      ));
      
      // 画像生成
      const result = await generateNextImageAction(pair.visualDescription);
      
      // 状態更新: ready or error
      setPairs(prev => prev.map(p => 
        p.id === pair.id 
          ? { 
              ...p, 
              imageUrl: result.imageUrl, 
              status: result.success ? 'ready' : 'error',
              generatedAt: new Date()
            } 
          : p
      ));
    }
  };
  
  const handleNextPair = () => {
    if (currentPairIndex < pairs.length - 1) {
      setCurrentPairIndex(prev => prev + 1);
    }
  };
  
  // 音声読み上げ完了時に自動的に次へ
  const handleSpeechEnd = () => {
    handleNextPair();
  };
  
  return (
    <ResultView
      currentPair={pairs[currentPairIndex]}
      totalPairs={pairs.length}
      currentIndex={currentPairIndex}
      onNext={handleNextPair}
      onSpeechEnd={handleSpeechEnd}
      agent={agent}
    />
  );
}
```

#### ResultView（更新）
```typescript
interface ResultViewProps {
  currentPair: SentenceImagePair;
  totalPairs: number;
  currentIndex: number;
  onNext: () => void;
  onSpeechEnd: () => void;
  agent: Agent;
}

export function ResultView({ 
  currentPair, 
  totalPairs, 
  currentIndex, 
  onNext, 
  onSpeechEnd,
  agent 
}: ResultViewProps) {
  const { speak, isSpeaking } = useTextToSpeech();
  
  useEffect(() => {
    // 新しいペアが表示されたら自動的に読み上げ開始
    if (currentPair.status === 'ready') {
      speak(currentPair.text, {
        onEnd: onSpeechEnd
      });
    }
  }, [currentPair.id]);
  
  return (
    <div className="result-container">
      {/* 進捗表示 */}
      <div className="progress">
        {currentIndex + 1} / {totalPairs}
      </div>
      
      {/* 画像表示 */}
      <div className="image-container">
        {currentPair.status === 'ready' && currentPair.imageUrl ? (
          <img src={currentPair.imageUrl} alt={`Step ${currentPair.stepNumber}`} />
        ) : currentPair.status === 'generating' ? (
          <LoadingSpinner />
        ) : (
          <ErrorPlaceholder />
        )}
      </div>
      
      {/* テキスト表示 */}
      <div className="text-container">
        <StreamingText text={currentPair.text} />
      </div>
      
      {/* 次へボタン（音声読み上げ中は無効化） */}
      <button 
        onClick={onNext} 
        disabled={isSpeaking || currentIndex >= totalPairs - 1}
      >
        次へ
      </button>
    </div>
  );
}
```

### 4. 並列処理の最適化

#### 画像生成のプリフェッチ戦略
```typescript
/**
 * 現在表示中のペアの次のN個の画像を先読み生成する
 * N = 2（デフォルト）
 */
const PREFETCH_COUNT = 2;

const generateNextImagesInBackground = async (
  allPairs: SentenceImagePair[], 
  startIndex: number
) => {
  // 並列生成数を制限（API負荷軽減）
  const MAX_PARALLEL = 2;
  
  for (let i = startIndex; i < allPairs.length; i += MAX_PARALLEL) {
    const batch = allPairs.slice(i, i + MAX_PARALLEL);
    
    // バッチ内は並列実行
    await Promise.all(
      batch.map(async (pair) => {
        setPairs(prev => prev.map(p => 
          p.id === pair.id ? { ...p, status: 'generating' } : p
        ));
        
        const result = await generateNextImageAction(pair.visualDescription);
        
        setPairs(prev => prev.map(p => 
          p.id === pair.id 
            ? { 
                ...p, 
                imageUrl: result.imageUrl, 
                status: result.success ? 'ready' : 'error',
                generatedAt: new Date()
              } 
            : p
        ));
      })
    );
  }
};
```

## UI/UX設計

### 表示フロー
1. **初回表示**: センテンス1 + 画像1が表示され、自動的に音声読み上げ開始
2. **読み上げ中**: テキストがハイライト表示され、画像がアニメーション
3. **読み上げ完了**: 自動的に次のペアに遷移（または手動で「次へ」ボタン）
4. **裏で生成中**: 次のペアの画像が生成中の場合、ローディングアニメーション表示
5. **最後のペア**: 「もう一度聞く」「新しい質問をする」ボタンを表示

### 進捗表示
- 上部に「1/4」「2/4」のような進捗インジケーター
- ドット表示で視覚的に進捗を表現
- 現在のステップをハイライト

### エラーハンドリング
- 画像生成失敗時: プレースホルダー画像を表示し、テキストのみで進行
- 音声読み上げ失敗時: テキスト表示のみで進行
- ネットワークエラー時: リトライボタンを表示

## 実装順序

### Phase 1: データ構造の変更
1. `SentenceImagePair`型の定義
2. `AgentResponse`の更新
3. `consultAction`の更新（最初の画像のみ生成）

### Phase 2: バックエンドAPI追加
1. `generateNextImageAction`の実装
2. エラーハンドリングの追加

### Phase 3: フロントエンド基本実装
1. `ResultView`の更新（1ペアずつ表示）
2. 進捗表示の実装
3. 「次へ」ボタンの実装

### Phase 4: 並列生成の実装
1. バックグラウンド画像生成ロジック
2. 状態管理の最適化
3. プリフェッチ戦略の実装

### Phase 5: 音声連携
1. 音声読み上げ完了時の自動遷移
2. 音声とテキストの同期表示

### Phase 6: UI/UXの洗練
1. アニメーション追加
2. ローディング状態の改善
3. エラー表示の改善

## パフォーマンス目標
- 最初のペア表示まで: 3秒以内
- 次のペアへの遷移: 即座（画像が生成済みの場合）
- 画像生成待ち時間: 最大5秒（ローディング表示）

## 互換性
- 既存の`ExplanationStep`構造は当面維持（段階的移行）
- 旧フローとの切り替えフラグを用意（`USE_PARALLEL_GENERATION`）

## 今後の拡張性
- ユーザーが任意のペアにジャンプできる機能
- ペアごとにお気に入り登録
- 複数の画像スタイルから選択
- リアルタイムストリーミング生成（Server-Sent Events）
