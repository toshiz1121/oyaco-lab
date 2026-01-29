# Vertex AI TTS モデル利用ガイド

## 🔍 問題: モデルが見つからない (404 Not Found)

### 試したモデル

1. ❌ `gemini-2.5-flash-preview-tts` - 404 Not Found (プレビュー版、アクセス制限あり)
2. ❌ `gemini-2.0-flash-exp` - 404 Not Found (TTS 専用ではない)
3. ✅ `gemini-2.5-flash-tts` - **現在使用中** (GA版、推奨)

## 📋 利用可能なモデル (asia-northeast1)

### TTS 専用モデル

| モデル名 | ステータス | 特徴 | 推奨度 |
|---------|----------|------|--------|
| `gemini-2.5-flash-tts` | GA | 低レイテンシー、高速 | ⭐⭐⭐ |
| `gemini-2.5-pro-tts` | GA | 高品質、長文対応 | ⭐⭐ |
| `gemini-2.5-flash-lite-preview-tts` | Preview | 超軽量版 | ⭐ |

## ✅ 現在の設定

**ファイル**: `src/lib/gemini.ts`

```typescript
const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.5-flash-tts:generateContent`;
```

**設定値**:
- プロジェクト: `bright-arc-485311-v1`
- リージョン: `asia-northeast1` (東京)
- モデル: `gemini-2.5-flash-tts`
- ボイス: `charon` (Informative)

## 🔧 トラブルシューティング

### 404 エラーが出る場合

#### 1. Vertex AI API が有効になっているか確認

```bash
gcloud services list --enabled --project=bright-arc-485311-v1 | grep aiplatform
```

有効になっていない場合:

```bash
gcloud services enable aiplatform.googleapis.com --project=bright-arc-485311-v1
```

#### 2. 認証情報の確認

サービスアカウントに以下の権限があるか確認:
- `roles/aiplatform.user` (Vertex AI User)
- `roles/ml.developer` (ML Developer)

#### 3. モデルのリージョン可用性を確認

```bash
gcloud ai models list \
  --region=asia-northeast1 \
  --project=bright-arc-485311-v1 \
  --filter="displayName:gemini"
```

#### 4. 別のモデルを試す

`gemini-2.5-pro-tts` を試してみる:

```typescript
const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/gemini-2.5-pro-tts:generateContent`;
```

#### 5. 別のリージョンを試す

`us-central1` など、他のリージョンを試してみる:

```typescript
const location = 'us-central1';
```

## 🎯 利用可能なボイス

### 日本語向け推奨ボイス

| ボイス名 | 特徴 | 用途 |
|---------|------|------|
| `charon` | Informative | 教育コンテンツ（現在使用中） |
| `kore` | Firm | 明確な説明 |
| `umbriel` | Easy-going | 親しみやすい |
| `achird` | Friendly | 子供向け |
| `puck` | Upbeat | 元気な説明 |
| `leda` | Youthful | 若々しい |

### ボイスの変更方法

```typescript
// src/lib/gemini.ts の generateSpeech 関数
export async function generateSpeech(
  text: string, 
  voiceName: string = 'puck'  // ここを変更
): Promise<string>
```

## 📊 API リクエスト形式

### 正しいリクエスト形式

```json
{
  "contents": [{
    "role": "user",
    "parts": [{ "text": "こんにちは、これはテストです。" }]
  }],
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "voiceConfig": {
        "prebuiltVoiceConfig": {
          "voiceName": "charon"
        }
      }
    }
  }
}
```

### レスポンス形式

```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "mimeType": "audio/pcm",
          "data": "base64_encoded_audio_data..."
        }
      }]
    }
  }]
}
```

## 🚀 代替案

### オプション A: Google Cloud Text-to-Speech API

より安定した従来の TTS API を使用:

```typescript
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const client = new TextToSpeechClient();

async function synthesizeSpeech(text: string) {
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
    audioConfig: { audioEncoding: 'MP3' },
  });
  return response.audioContent;
}
```

### オプション B: Web Speech API のみ使用

Vertex AI を使用せず、完全にクライアント側で処理:

```typescript
// src/app/actions.ts
export async function generateSpeechAction(text: string): Promise<string | null> {
  // 常に null を返して Web Speech API を使用
  return null;
}
```

## 🧪 デバッグ方法

### 1. コンソールログを確認

開発サーバーのコンソールで以下を確認:

```
[DEBUG] TTS Request URL: https://...
[DEBUG] TTS Request Body: {...}
[ERROR] Vertex AI TTS Error Response: {...}
```

### 2. curl でテスト

```bash
# アクセストークンを取得
TOKEN=$(gcloud auth print-access-token)

# API を直接呼び出し
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "role": "user",
      "parts": [{"text": "テスト"}]
    }],
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "charon"
          }
        }
      }
    }
  }' \
  "https://asia-northeast1-aiplatform.googleapis.com/v1/projects/bright-arc-485311-v1/locations/asia-northeast1/publishers/google/models/gemini-2.5-flash-tts:generateContent"
```

### 3. Google Cloud Console で確認

1. [Vertex AI Model Garden](https://console.cloud.google.com/vertex-ai/model-garden) にアクセス
2. `gemini-2.5-flash-tts` を検索
3. モデルが利用可能か確認
4. 必要に応じて「Enable」をクリック

## ✅ チェックリスト

- [ ] Vertex AI API が有効になっている
- [ ] サービスアカウントに適切な権限がある
- [ ] モデルがリージョンで利用可能
- [ ] リクエスト形式が正しい
- [ ] 認証トークンが有効
- [ ] プロジェクト ID が正しい
- [ ] リージョンが正しい

## 📚 参考リンク

- [Vertex AI Gemini TTS Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini-tts)
- [Available Voices](https://ai.google.dev/gemini-api/docs/models/gemini-tts#voices)
- [Vertex AI Locations](https://cloud.google.com/vertex-ai/docs/general/locations)
