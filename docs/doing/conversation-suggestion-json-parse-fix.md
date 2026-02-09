# 会話提案のJSONパースエラー修正

## 🔍 問題

`generateConversationSuggestion` 関数でJSONパースエラーが発生：

```
SyntaxError: Unterminated string in JSON at position 16
Raw text: [
```

AIからの応答が途中で切れている（"["のみ）。

## 原因

### 1. maxOutputTokensが小さすぎる

```typescript
maxOutputTokens: 500  // ← 小さすぎて応答が途中で切れる
```

日本語は1文字あたり2-3トークン消費するため、500トークンでは不十分。

### 2. responseMimeTypeの問題

```typescript
responseMimeType: 'application/json'
```

Gemini 2.5 Flashでは、この設定が期待通りに動作しない場合がある。

### 3. プロンプトが不明確

```typescript
const prompt = `子供との会話きっかけを3つ提案してください。
JSON形式で回答（例を参考に）:
[...]`;
```

「例を参考に」という曖昧な指示では、AIが余計な説明を追加する可能性がある。

### 4. エラーハンドリングが不十分

- リトライロジックがない
- 失敗時のフォールバックが不完全
- デバッグ情報が不足

## 🔧 修正内容

### 1. maxOutputTokensを増やす

```typescript
generationConfig: {
  temperature: 0.7,
  maxOutputTokens: 1024,  // 500 → 1024に増加
  topP: 0.95,
  topK: 40,
}
```

### 2. responseMimeTypeを削除

```typescript
// responseMimeType: 'application/json', ← 削除
```

代わりに、プロンプトで明確に指示する。

### 3. プロンプトを改善

```typescript
const prompt = `あなたは子育てアドバイザーです。以下の情報をもとに、親が子供と会話を始めるきっかけを3つ提案してください。

【子供の情報】
名前: ${profile.name}
年齢: ${profile.age}歳
興味のある分野: ${profile.stats.favoriteTopics.slice(0, 3).join('、') || '不明'}

【最近の質問履歴】
${recentQuestions || 'まだ質問履歴がありません'}

【出力形式】
必ず以下のJSON配列形式で出力してください。他のテキストや説明は一切含めないでください：

[
  {
    "emoji": "🍽️",
    "situation": "夕食時に",
    "topic": "食べ物の話",
    "question": "今日のご飯で一番おいしかったのは何？"
  },
  {
    "emoji": "🛁",
    "situation": "お風呂で",
    "topic": "水の不思議",
    "question": "お風呂のお湯はどこから来るのかな？"
  },
  {
    "emoji": "🌙",
    "situation": "寝る前に",
    "topic": "今日の出来事",
    "question": "今日一番楽しかったことは何？"
  }
]

上記の形式で、${profile.name}さん（${profile.age}歳）に合った3つの提案を生成してください。`;
```

**改善点**:
- 「他のテキストや説明は一切含めないでください」を明記
- 具体的な例を提示
- 構造化された指示

### 4. 詳細なログ出力

```typescript
// レスポンス全体をログ出力
console.log('[generateConversationSuggestion] Full response:', JSON.stringify({
  candidates: response?.candidates?.length,
  promptFeedback: response?.promptFeedback,
  usageMetadata: response?.usageMetadata,
}, null, 2));

// 安全フィルターやブロックをチェック
if (response?.promptFeedback?.blockReason) {
  console.error('[generateConversationSuggestion] Prompt blocked:', response.promptFeedback.blockReason);
  return { suggestions: [], cached: false, error: 'プロンプトがブロックされました' };
}

const candidate = response?.candidates?.[0];
if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
  console.warn('[generateConversationSuggestion] Unusual finish reason:', candidate.finishReason);
}

console.log('[generateConversationSuggestion] Response received, length:', text.length);
console.log('[generateConversationSuggestion] First 200 chars:', text.substring(0, 200));
```

### 5. JSONパース処理の改善

```typescript
// マークダウンのコードブロックを削除
let jsonString = text.trim();

// ```json ... ``` または ``` ... ``` を削除
jsonString = jsonString.replace(/^```json\s*\n?/i, '').replace(/^```\s*\n?/, '');
jsonString = jsonString.replace(/\n?```\s*$/, '');
jsonString = jsonString.trim();

console.log('[generateConversationSuggestion] Cleaned JSON string:', jsonString.substring(0, 200));

const parsed = JSON.parse(jsonString);
suggestions = Array.isArray(parsed) ? parsed : [];

console.log('[generateConversationSuggestion] Successfully parsed', suggestions.length, 'suggestions');
```

### 6. リトライロジックの追加

```typescript
export async function generateConversationSuggestion(
  childId: string,
  forceRefresh: boolean = false
): Promise<SuggestionResult> {
  const MAX_RETRIES = 2;
  let profile: any = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[generateConversationSuggestion] Retry attempt ${attempt}/${MAX_RETRIES}`);
      }
      
      // プロフィールを取得（初回のみ）
      if (!profile) {
        profile = await getChildProfile(childId);
        if (!profile) {
          return { suggestions: [], cached: false, error: '子供のプロフィールが見つかりません' };
        }
      }

      const result = await generateSuggestionInternal(childId, profile);
      
      if (result.suggestions.length > 0) {
        return result;
      }
      
      // 提案が0件の場合はリトライ
      if (attempt < MAX_RETRIES) {
        console.warn(`[generateConversationSuggestion] No suggestions generated, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      return result;
      
    } catch (error) {
      console.error(`[generateConversationSuggestion] Attempt ${attempt + 1} failed:`, error);
      
      if (attempt === MAX_RETRIES) {
        return {
          suggestions: [],
          cached: false,
          error: '提案の生成中にエラーが発生しました',
        };
      }
      
      // リトライ前に少し待機（指数バックオフ）
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  return {
    suggestions: [],
    cached: false,
    error: '提案の生成に失敗しました',
  };
}
```

**リトライロジックの特徴**:
- 最大3回試行（初回 + 2回リトライ）
- 指数バックオフ（1秒、2秒）
- 提案が0件の場合もリトライ
- プロフィールは初回のみ取得（効率化）

### 7. エラー検出の強化

```typescript
// 応答が途中で切れている可能性をチェック
if (text.length < 50 || !text.includes('}')) {
  console.error('[generateConversationSuggestion] Response appears to be truncated');
}
```

## 📋 期待される動作

### 成功時

```
[generateConversationSuggestion] Calling Vertex AI...
[generateConversationSuggestion] Full response: {
  "candidates": 1,
  "usageMetadata": { "promptTokenCount": 150, "candidatesTokenCount": 300 }
}
[generateConversationSuggestion] Response received, length: 450
[generateConversationSuggestion] First 200 chars: [
  {
    "emoji": "🍽️",
    "situation": "夕食時に",
    ...
[generateConversationSuggestion] Cleaned JSON string: [{"emoji":"🍽️",...
[generateConversationSuggestion] Successfully parsed 3 suggestions
[generateConversationSuggestion] Generated 3 suggestions for child_123
```

### リトライ時

```
[generateConversationSuggestion] Calling Vertex AI...
[generateConversationSuggestion] Response appears to be truncated
[generateConversationSuggestion] No suggestions generated, retrying...
[generateConversationSuggestion] Retry attempt 1/2
[generateConversationSuggestion] Calling Vertex AI...
[generateConversationSuggestion] Successfully parsed 3 suggestions
```

### 失敗時（フォールバック）

```
[generateConversationSuggestion] Attempt 3 failed: ...
[generateConversationSuggestion] Using fallback suggestions
```

## 🧪 テスト方法

### ローカルでテスト

```bash
# 開発サーバーを起動
npm run dev

# 親ダッシュボードにアクセス
# http://localhost:3000/parent

# 「会話のきっかけ」セクションを確認
# ブラウザのコンソールでログを確認
```

### Cloud Runでテスト

```bash
# ログをリアルタイムで監視
gcloud run services logs tail kids-science-lab --region=asia-northeast1

# 親ダッシュボードで「会話のきっかけ」を更新
# ログで以下を確認:
# - Vertex AI呼び出しが成功している
# - JSONパースが成功している
# - 3つの提案が生成されている
```

## ✅ 確認項目

- [ ] maxOutputTokensが1024に設定されている
- [ ] responseMimeTypeが削除されている
- [ ] プロンプトが明確で構造化されている
- [ ] 詳細なログが出力されている
- [ ] JSONパース処理が堅牢になっている
- [ ] リトライロジックが実装されている
- [ ] フォールバック提案が用意されている

## 🔍 トラブルシューティング

### まだ応答が切れる場合

```typescript
maxOutputTokens: 2048  // さらに増やす
```

### finishReasonが'MAX_TOKENS'の場合

```typescript
if (candidate?.finishReason === 'MAX_TOKENS') {
  console.error('[generateConversationSuggestion] Response truncated due to token limit');
  // maxOutputTokensを増やす必要がある
}
```

### プロンプトがブロックされる場合

```typescript
if (response?.promptFeedback?.blockReason) {
  console.error('Block reason:', response.promptFeedback.blockReason);
  console.error('Safety ratings:', response.promptFeedback.safetyRatings);
  // プロンプトの内容を見直す
}
```

## 📚 参考

- [Gemini API - Generation Config](https://ai.google.dev/api/generate-content#generationconfig)
- [Vertex AI - Safety Settings](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/responsible-ai)
- [JSON Parsing Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
