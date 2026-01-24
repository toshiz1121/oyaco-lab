# Phase 8: 画像アップロード + リミックス機能の設計書

**ステータス**: 計画中  
**最終更新**: 2026-01-06  
**対応Issue**: 巨匠切り替え時のスタイル維持問題

---

## 📋 要件定義

### 現状の問題

巨匠Aが生成した絵を、巨匠Bに切り替えて修正すると、巨匠Aのスタイルが維持されてしまう。

### ユーザーインタビューからの洞察 💡

> 「通常のChatGPTとかのように画像をアップしてかつ指示できるようなのを想定しているだけだよ。Rooと話しているときもそうじゃん。」

**重要な発見**:
- リミックスの本質は「画像 + テキスト指示」を同時に送れるインターフェース
- 例: 「2人映っている写真を渡して左の人だけ写楽風にして」
- ChatGPT/Rooと同じUXを目指すべき

### 優先順位の変更 ⚠️

**当初の提案**: Phase 8.1（リミックス）→ 8.2（履歴）→ 8.3（アップロード）

**ユーザーの意向**: **アップロードが最重要**

**理由**:
- アップロードがあれば、過去の作品を再アップロードして自由にリミックスできる
- 履歴機能は、アップロード+リミックスの実装を整理してから必要性を再評価
- 「リミックス = ある画像をベースに加工を指示する」という本質を先に実装すべき

---

## 🎯 Phase 8.1の再定義

### 目的

1. 現在の問題（巨匠切り替え時のスタイル維持）を解決
2. 自由なリミックスの基盤を作る
3. **ChatGPT/Rooと同じUX（画像+指示）を実現** ← 新規

### 実装スコープ

**実装する**:
1. 画像アップロード機能（ドラッグ&ドロップ）
2. **テキスト指示入力欄（オプション）** ← 新規
3. 画像+指示+巨匠の画風で生成
4. 生成画像のリミックス機能（巨匠切り替え対応）

**実装しない**:
- 作品履歴（複数保持）
- サムネイル一覧
- 作品比較
- 作品の系譜表示

**理由**: MVPをシンプルに保ち、まず使ってもらってから必要性を判断する

---

## 🎨 UI/UX設計

### レイアウト構成（3カラム）

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Masterpiece Maker                                       │
├──────────────┬──────────────────────────┬───────────────────────┤
│ 左カラム     │ 中央カラム               │ 右カラム              │
│ (入力)       │ (出力)                   │ (対話)                │
│              │                          │                       │
│ 📤 画像UP    │ 📷 Canvas                │ 💬 巨匠と対話         │
│ [D&D]        │ ┌──────────────────────┐ │ ┌─────────────────┐ │
│              │ │   [作品画像]         │ │ │ ピカソ          │ │
│ 🎨 巨匠選択  │ └──────────────────────┘ │ │ "どうだ？"      │ │
│ [ピカソ]     │                          │ └─────────────────┘ │
│ [ゴッホ]...  │ [ダウンロード]           │                       │
│              │                          │ [修正依頼]            │
│ 📝 追加指示  │                          │ [リミックス]          │
│ [入力欄]     │                          │                       │
│              │                          │                       │
│ [変換]       │                          │                       │
└──────────────┴──────────────────────────┴───────────────────────┘
```

### 新しいUI要素

#### 1. 画像アップロードエリア（左カラム上部）

```
┌─────────────────────────────────────┐
│ 📤 画像をアップロード               │
│ ┌─────────────────────────────────┐ │
│ │ ドラッグ&ドロップ               │ │
│ │ または                          │ │
│ │ [ファイルを選択]                │ │
│ └─────────────────────────────────┘ │
│                                     │
│ サポート: PNG, JPEG, WebP          │
│ 最大サイズ: 10MB                    │
└─────────────────────────────────────┘
```

#### 2. テキスト指示入力欄（左カラム中部）← 新規

```
┌─────────────────────────────────────┐
│ 📝 追加指示（オプション）           │
│ ┌─────────────────────────────────┐ │
│ │ 例: 左の人だけ写楽風にして      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ヒント:                             │
│ • 空欄の場合、画像全体を変換        │
│ • 部分的な変更も指示できます        │
└─────────────────────────────────────┘
```

#### 3. 巨匠選択（左カラム中部）

```
┌─────────────────────────────────────┐
│ 🎨 巨匠を選択                       │
│ [ピカソ] [ゴッホ] [モネ] ...       │
│                                     │
│ 現在の作品: ピカソ 🔒               │
│ 選択中: ゴッホ ✨                   │
│                                     │
│ ⚠️ 巨匠が異なります                │
│ [ゴッホの画風で描き直す]            │
└─────────────────────────────────────┘
```

#### 4. 変換ボタン（左カラム下部）

```
┌─────────────────────────────────────┐
│ [変換]                              │
│                                     │
│ • アップロード画像を変換            │
│ • 生成画像をリミックス              │
└─────────────────────────────────────┘
```

---

## 🔧 技術設計

### データモデル

#### Artwork（作品）

```typescript
interface Artwork {
  id: string;                    // 一意のID
  imageUrl: string;              // 画像データ（Base64）
  artistId: string;              // 制作した巨匠のID
  theme?: string;                // テーマ（生成時のみ）
  instruction?: string;          // テキスト指示（アップロード時）
  createdAt: number;             // 作成日時
  source: 'generated' | 'uploaded' | 'remixed';
}
```

### State管理

```typescript
// page.tsx
interface AppState {
  // 現在の作品（1件のみ）
  currentArtwork: Artwork | null;
  
  // 巨匠選択
  selectedArtistId: string | null;
  
  // テーマ（生成時のみ）
  theme: string;
  
  // アップロード関連
  uploadedImage: string | null;  // Base64
  instruction: string;           // テキスト指示
  
  // UI状態
  isGenerating: boolean;
  isUploading: boolean;
  isRemixing: boolean;
}

// 巨匠の不一致を検知
const isArtistMismatch = 
  currentArtwork && 
  selectedArtistId && 
  currentArtwork.artistId !== selectedArtistId;
```

### Server Actions

#### 1. uploadAndTransformAction（新規）

```typescript
export async function uploadAndTransformAction(
  imageBase64: string,
  artistId: string,
  instruction?: string
): Promise<GenerateResult> {
  const artist = artists.find((a) => a.id === artistId);
  
  // プロンプト構築
  let prompt = `Transform this image in the style of ${artist.nameEn} (${artist.style}).`;
  
  // テキスト指示がある場合は先頭に追加
  if (instruction && instruction.trim()) {
    prompt = `${instruction.trim()} ${prompt}`;
  }
  
  const negativePrompt = getNegativePrompt(artistId);
  
  // Base64データを取り出し
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || "image/png";
  
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt + (negativePrompt ? `\n\nAvoid: ${negativePrompt}` : "") },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "1:1" },
      candidateCount: 1
    }
  };
  
  const data = await callGeminiApi(MODEL_NAME_IMAGE, requestBody);
  
  // ... レスポンス処理
}
```

#### 2. remixArtworkAction（既存を更新）

```typescript
export async function remixArtworkAction(
  originalArtistId: string,
  newArtistId: string,
  currentImageUrl: string,
  instruction?: string  // ← 新規パラメータ
): Promise<GenerateResult> {
  const newArtist = artists.find((a) => a.id === newArtistId);
  
  // プロンプト構築
  let prompt = `Reinterpret this artwork in the style of ${newArtist.nameEn} (${newArtist.style}). 
  Maintain the overall composition and subject matter, but transform it completely into ${newArtist.nameEn}'s artistic vision.`;
  
  // テキスト指示がある場合は先頭に追加
  if (instruction && instruction.trim()) {
    prompt = `${instruction.trim()} ${prompt}`;
  }
  
  const negativePrompt = getNegativePrompt(newArtistId);
  
  // Base64データを取り出し
  const base64Data = currentImageUrl.replace(/^data:image\/\w+;base64,/, "");
  const mimeType = currentImageUrl.match(/^data:(image\/\w+);base64,/)?.[1] || "image/png";
  
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt + (negativePrompt ? `\n\nAvoid: ${negativePrompt}` : "") },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "1:1" },
      candidateCount: 1
    }
  };
  
  const data = await callGeminiApi(MODEL_NAME_IMAGE, requestBody);
  
  // ... レスポンス処理
}
```

### コンポーネント設計

#### 1. ImageUploader（新規）

```typescript
interface ImageUploaderProps {
  onUpload: (imageBase64: string) => void;
  disabled?: boolean;
}

export function ImageUploader({ onUpload, disabled }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };
  
  const handleFile = async (file: File) => {
    // ファイルサイズチェック（10MB制限）
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ファイルサイズは10MB以下にしてください");
      return;
    }
    
    // 画像形式チェック
    if (!file.type.startsWith('image/')) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    
    // Base64に変換
    const reader = new FileReader();
    reader.onload = () => {
      onUpload(reader.result as string);
      toast.success("画像をアップロードしました");
    };
    reader.onerror = () => {
      toast.error("アップロードに失敗しました");
    };
    reader.readAsDataURL(file);
  };
  
  return (
    <Card
      className={`border-2 border-dashed ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <CardContent className="p-6 text-center">
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-4">
          ドラッグ&ドロップ<br />または
        </p>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          ファイルを選択
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <p className="text-xs text-muted-foreground mt-4">
          PNG, JPEG, WebP（最大10MB）
        </p>
      </CardContent>
    </Card>
  );
}
```

#### 2. InstructionInput（新規）

```typescript
interface InstructionInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function InstructionInput({ value, onChange, disabled }: InstructionInputProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">追加指示（オプション）</CardTitle>
        <CardDescription className="text-xs">
          部分的な変更も指示できます
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="例: 左の人だけ写楽風にして"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-2">
          空欄の場合、画像全体を変換します
        </p>
      </CardContent>
    </Card>
  );
}
```

#### 3. ArtistMismatchAlert（既存を更新）

```typescript
interface ArtistMismatchAlertProps {
  currentArtistId: string;
  selectedArtistId: string;
  onRemix: () => void;
}

export function ArtistMismatchAlert({
  currentArtistId,
  selectedArtistId,
  onRemix
}: ArtistMismatchAlertProps) {
  const currentArtist = artists.find(a => a.id === currentArtistId);
  const selectedArtist = artists.find(a => a.id === selectedArtistId);
  
  if (currentArtistId === selectedArtistId) return null;
  
  return (
    <Alert className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>巨匠が異なります</AlertTitle>
      <AlertDescription>
        <p className="text-sm mb-2">
          現在の作品: {currentArtist?.name}<br />
          選択中: {selectedArtist?.name}
        </p>
        <Button onClick={onRemix} variant="secondary" size="sm" className="w-full">
          {selectedArtist?.name}の画風で描き直す
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

#### 4. page.tsx（メインページの更新）

```typescript
export default function Home() {
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [currentArtwork, setCurrentArtwork] = useState<Artwork | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const selectedArtist = artists.find((a) => a.id === selectedArtistId);
  const isArtistMismatch = currentArtwork && selectedArtistId && 
                           currentArtwork.artistId !== selectedArtistId;

  // 画像アップロード処理
  const handleImageUpload = (imageBase64: string) => {
    setUploadedImage(imageBase64);
    setCurrentArtwork(null); // 既存の作品をクリア
  };

  // 変換処理（アップロード画像 or テーマ生成）
  const handleTransform = async () => {
    if (!selectedArtistId) {
      toast.error("巨匠を選択してください");
      return;
    }

    setIsGenerating(true);

    try {
      let result;
      
      if (uploadedImage) {
        // アップロード画像を変換
        result = await uploadAndTransformAction(
          uploadedImage,
          selectedArtistId,
          instruction
        );
      } else if (theme.trim()) {
        // テーマから生成（既存機能）
        result = await generateArtworkAction(selectedArtistId, theme);
      } else {
        toast.error("画像をアップロードするか、テーマを入力してください");
        return;
      }

      if (result.success && result.imageUrl) {
        setCurrentArtwork({
          id: Date.now().toString(),
          imageUrl: result.imageUrl,
          artistId: selectedArtistId,
          theme: theme || undefined,
          instruction: instruction || undefined,
          createdAt: Date.now(),
          source: uploadedImage ? 'uploaded' : 'generated'
        });
        toast.success("作品が完成しました！");
      } else {
        toast.error(result.error || "生成に失敗しました");
      }
    } catch (error) {
      console.error(error);
      toast.error("予期せぬエラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  };

  // リミックス処理
  const handleRemix = async () => {
    if (!currentArtwork || !selectedArtistId) return;

    setIsGenerating(true);

    try {
      const result = await remixArtworkAction(
        currentArtwork.artistId,
        selectedArtistId,
        currentArtwork.imageUrl,
        instruction
      );

      if (result.success && result.imageUrl) {
        setCurrentArtwork({
          id: Date.now().toString(),
          imageUrl: result.imageUrl,
          artistId: selectedArtistId,
          theme: currentArtwork.theme,
          instruction: instruction || undefined,
          createdAt: Date.now(),
          source: 'remixed'
        });
        toast.success("リミックスが完成しました！");
      } else {
        toast.error(result.error || "リミックスに失敗しました");
      }
    } catch (error) {
      console.error(error);
      toast.error("予期せぬエラーが発生しました");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* ... ヘッダー ... */}

      <div className="flex flex-1 overflow-hidden">
        {/* 左カラム: 入力エリア */}
        <div className="w-80 flex-shrink-0 border-r overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* 画像アップロード */}
            <section>
              <ImageUploader
                onUpload={handleImageUpload}
                disabled={isGenerating}
              />
            </section>

            {/* テーマ入力（既存） */}
            <section>
              <ThemeInput
                theme={theme}
                onChange={setTheme}
                disabled={isGenerating || !!uploadedImage}
              />
            </section>

            {/* 巨匠選択 */}
            <section>
              <ArtistSelector
                selectedArtistId={selectedArtistId}
                onSelect={setSelectedArtistId}
              />
              
              {/* 巨匠不一致アラート */}
              {isArtistMismatch && (
                <ArtistMismatchAlert
                  currentArtistId={currentArtwork.artistId}
                  selectedArtistId={selectedArtistId}
                  onRemix={handleRemix}
                />
              )}
            </section>

            {/* テキスト指示入力 */}
            <section>
              <InstructionInput
                value={instruction}
                onChange={setInstruction}
                disabled={isGenerating}
              />
            </section>

            {/* 変換ボタン */}
            <Button
              size="lg"
              className="w-full text-lg font-bold py-6"
              onClick={handleTransform}
              disabled={isGenerating || !selectedArtistId || (!uploadedImage && !theme.trim())}
            >
              {isGenerating ? "制作中..." : "変換"}
            </Button>
          </div>
        </div>

        {/* 中央カラム: 出力エリア */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <Card className="border-2 border-dashed border-muted-foreground/20">
              <CardHeader>
                <CardTitle className="text-sm">Canvas</CardTitle>
                <CardDescription className="text-xs">
                  ここに作品が表示されます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GeneratorCanvas
                  imageUrl={currentArtwork?.imageUrl || null}
                  isLoading={isGenerating}
                  onDownload={() => {
                    if (currentArtwork?.imageUrl) {
                      const link = document.createElement("a");
                      link.href = currentArtwork.imageUrl;
                      link.download = `masterpiece-${Date.now()}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                  selectedArtist={selectedArtist || null}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 右カラム: チャットエリア（既存） */}
        {/* ... */}
      </div>
    </main>
  );
}
```

---

## 📊 実装の優先順位

### Phase 8.1: 画像アップロード + リミックス機能 ⭐️ **最優先**

**実装内容**:
- [ ] `ImageUploader`コンポーネント
- [ ] `InstructionInput`コンポーネント
- [ ] `uploadAndTransformAction`の実装
- [ ] `remixArtworkAction`の更新（instruction パラメータ追加）
- [ ] `page.tsx`の更新（State管理、UI統合）
- [ ] `ArtistMismatchAlert`の更新

**期待される成果**:
- ✅ ユーザーが自分の写真をアップロードして、巨匠風に変換できる
- ✅ 「左の人だけ写楽風にして」のような追加指示ができる
- ✅ 生成した作品を別の巨匠でリミックスできる
- ✅ アップロード画像を複数の巨匠でリミックスできる
- ✅ 現在の問題（巨匠切り替え時のスタイル維持）が解決されている
- ✅ ChatGPT/Rooと同じUX（画像+指示）を実現できている

**工数見積もり**: 6-8時間

---

### Phase 8.2以降: 保留

以下の機能は、Phase 8.1の実装後に必要性を再評価します：

- 作品履歴管理（複数保持）
- サムネイル一覧
- 前後ナビゲーション
- 作品の系譜表示
- 作品比較機能

**理由**: アップロード+リミックスで十分な可能性がある。まず使ってもらってから判断する。

---

## 🔍 技術的考慮事項

### 1. パフォーマンス

**課題**: Base64画像のメモリ使用量

**対策**:
- ファイルサイズ制限（10MB）
- 1件のみ保持（シンプルに）
- 必要に応じてLocalStorageに保存（将来の拡張）

### 2. プロンプト構築

**課題**: テキスト指示と画風指定の組み合わせ

**対策**:
```typescript
// テキスト指示がある場合
const prompt = `${instruction} Transform this image in the style of ${artist.nameEn} (${artist.style}).`;

// テキスト指示がない場合
const prompt = `Transform this image in the style of ${artist.nameEn} (${artist.style}).`;
```

### 3. エラーハンドリング

**課題**: アップロード、変換、リミックスの各段階でエラーが発生する可能性

**対策**:
- ファイルサイズ・形式のバリデーション
- API呼び出しのエラーハンドリング
- ユーザーへの明確なエラーメッセージ
- 元画像の保持（失敗時に復元可能）

### 4. API制限

**課題**: 連続リミックスでAPI制限に到達

**対策**:
- レート制限の実装（1分に3回まで）
- エラーハンドリングの強化
- ユーザーへの警告表示

---

## 📝 ユーザーストーリーとの対応

詳細なユーザーストーリーは[`user-stories-phase8.md`](../user-stories-phase8.md)を参照してください。

| ユーザーストーリー | Phase |
|-------------------|-------|
| US-8.1: 画像をアップロードして巨匠風に変換する | Phase 8.1 |
| US-8.2: 生成した作品を別の巨匠でリミックスする | Phase 8.1 |
| US-8.3: アップロード画像をリミックスする | Phase 8.1 |
| US-8.4: 過去の作品を再利用する | Phase 8.1 |

---

## 🚀 次のステップ

1. **Phase 8.1の実装開始**
   - `ImageUploader`コンポーネント
   - `InstructionInput`コンポーネント
   - `uploadAndTransformAction`の実装
   - 動作確認とテスト

2. **ユーザーフィードバックの収集**
   - 実際に使ってもらう
   - 履歴管理の必要性を確認
   - 作品比較の必要性を確認

3. **Phase 8.2の検討**
   - フィードバックをもとに次の機能を決定

---

## 📚 参考

- ユーザーストーリー: [`tools/master-piece/docs/user-stories-phase8.md`](../user-stories-phase8.md)
- 既存のユーザーストーリー: [`tools/master-piece/docs/user-stories.md`](../user-stories.md)
- 現在の実装: [`tools/master-piece/src/app/actions.ts`](../../src/app/actions.ts:306)
- チャットUI: [`tools/master-piece/src/components/ChatInterface.tsx`](../../src/components/ChatInterface.tsx)
