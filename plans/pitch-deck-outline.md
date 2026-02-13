# Kids Science Lab: ハッカソン・デモデイ向けピッチスライド構成案

## 🎯 コンセプト
**「好奇心に、最高の相棒を。」**
忙しい親に代わり、AI博士たちが子供の「なぜ？」に寄り添い、世界を広げる。

## 📊 スライド構成（全10枚）

| No | タイトル | 目的・内容 | 視覚要素・備考 |
|----|----------|------------|----------------|
| 1 | **Title / Hook** | タイトル、キャッチコピー、チーム名。<br>一言で「何を作るのか」を伝える。 | 子供がタブレットで楽しそうに博士と話しているビジュアル。<br>キャッチコピー: "Curiosity's Best Friend" |
| 2 | **Problem (The Pain)** | 親子の会話時間の減少（データに基づく）。<br>「会話はしたいが時間がない」ジレンマと「スマホへの依存」。 | グラフ：親子の会話時間減少（シチズン時計調査2025）。<br>スマホを見る親と、退屈そうな子供の対比。 |
| 3 | **Solution (The Core)** | **Kids Science Lab** の提案。<br>個性豊かな7人のAI博士との「対話」×「視覚的解説」。<br>受動的視聴から能動的探求へ。 | 7人の博士キャラクターの集合絵。<br>UIのメイン画面（チャット）。 |
| 4 | **Demo / UX Flow** | **デモ動画/GIF** (最重要)。<br>音声入力 → 博士の回答 → 画像生成 → 深掘り提案 の流れを見せる。 | 実際の動作画面。<br>音声波形アニメーション → 画像生成の様子。 |
| 5 | **Technology (Architecture)** | 技術的な凄み。<br>Orchestrator-Workers パターン。<br>Gemini 2.5 Flash (高速応答) + Imagen 3 (高品質画像) + TTS。 | アーキテクチャ図。<br>Next.js, Firebase, Vertex AIのロゴ。<br>データの流れを矢印で示す。 |
| 6 | **Technology (Special Sauce)** | 工夫した点。<br>1. **並列生成:** テキスト・画像・音声を並列処理しレイテンシ短縮。<br>2. **Educator Review:** スマイル先生による「分かりやすさ」自動チェック。 | 並列処理のタイムライン図（Before/After）。<br>Educatorエージェントが修正指示を出しているログのイメージ。 |
| 7 | **For Parents (Value)** | 親への価値。<br>ただの遊びじゃない。「興味の可視化」と「会話のきっかけ」。<br>ReActエージェントによる親へのアドバイス。 | 親向けダッシュボードの画面。<br>「宇宙に興味が高まっています」等のレポート画面。 |
| 8 | **Business / Impact** | 市場規模と社会的意義。<br>EdTech市場、STEM教育への関心。<br>「罪悪感」を「安心感・信頼」へ変える。 | グラフ（市場規模）。<br>笑顔の親子の写真。 |
| 9 | **Roadmap / Future** | 今後の展望。<br>音声対話の進化、マルチリンガル対応、学校・塾との連携。<br>「AIネイティブ世代の教科書」へ。 | ロードマップの矢印。<br>未来の機能アイコン。 |
| 10 | **Team / Call to Action** | チーム紹介。<br>改めて「Kids Science Lab」を印象付ける。<br>QRコードでデモへ誘導。 | チームメンバーの写真・役割。<br>大きなプロダクトロゴとQRコード。 |

---

## 📝 各スライド詳細

### 1. Title / Hook
*   **Main:** Kids Science Lab
*   **Sub:** AIエージェントが育む、子供の無限の好奇心
*   **Visual:** メインビジュアル（楽しそうな子供とAI博士）

### 2. Problem: "会話時間の減少"という現実
*   **Text:**
    *   **事実:** 親子の会話時間は減少傾向にある（シチズン時計「親子のふれあい時間」調査 2025）。
        *   平日：父親 52分、母親 1時間34分（約2割減少）。
        *   休日：さらに20分以上減少。
    *   **背景:** 子供の自立、そして**スマホ・タブレットの利用増加**。同じ空間にいても個別の活動をしてしまう。
    *   **課題:** 子供の好奇心を受け止める「時間」と「余裕」が圧倒的に足りない。
*   **Visual:**
    *   調査データのグラフ（減少傾向を強調）。
    *   リビングで別々の画面を見ている親子のイラスト。

### 3. Solution
*   **Text:**
    *   **Kids Science Lab** は、子供専用の科学研究所。
    *   7人の専門家AI（博士）が、いつでも、何度でも、子供の「なぜ？」に付き合います。
    *   **Key Features:**
        *   音声対話（文字が読めなくてもOK）
        *   リアルタイム画像生成（視覚で理解）
        *   子供に合わせたペルソナ（優しく、面白く）
*   **Visual:** アプリのメイン画面。7人の博士アイコンが並んでいる様子。

### 4. Demo (The Magic)
*   **Action:** ここでデモ動画を再生。
*   **Scenario:**
    1.  子供「空はなんで青いの？」
    2.  Orchestratorが「ニュートン博士」を選定。
    3.  ニュートン博士「いい質問じゃな！」（音声）
    4.  説明に合わせて、空と太陽の図解イラストが生成・表示される。
    5.  子供「もっと教えて！」→ 深掘り提案へ。

### 5. Technology: Architecture
*   **Text:**
    *   **Multi-Agent Orchestration:** ユーザーの意図を理解し、最適な専門家エージェントを動的選定。
    *   **Full Google Stack:**
        *   LLM: **Gemini 2.5 Flash** (Low Latency)
        *   Image: **Imagen 3** (High Quality)
        *   Voice: **Vertex AI TTS** / Web Speech API
*   **Visual:** `docs/architecture.md` をベースにした、簡略化・強調版のシステム構成図。

### 6. Technology: "Special Sauce"
*   **Text:**
    *   **Parallel Generation Pipeline:** テキストストリーミング中に画像と音声を裏で生成。子供を待たせないUXを実現。
    *   **Educator Review Loop:** 出力前に「スマイル先生」エージェントが内容を監査。「6歳児にわかる言葉か？」「不適切な表現はないか？」をチェックし、品質を担保。
*   **Visual:**
    *   シーケンス図（並列処理）。
    *   Reviewerエージェントの思考ログ（"Too difficult words detected -> Rewriting..."）。

### 7. For Parents (ReAct Agent)
*   **Text:**
    *   親も置き去りにしない。
    *   **Parent Dashboard:** 子供の興味・関心をデータ化。
    *   **Advisor Agent (ReAct):** Gemini Function Callingを活用。「最近、宇宙への興味が増えています。週末はプラネタリウムどうですか？」と具体的に提案。
*   **Visual:** ダッシュボード画面（グラフ、アドバイスチャット）。

### 8. Impact & Future
*   **Text:**
    *   **Impact:** 親子のコミュニケーション時間を「質」でカバー。
    *   **Future:**
        *   記憶の永続化（成長記録としての側面）。
        *   マルチモーダル入力（散歩中に見つけた花の写真をアップ → 解説）。
*   **Visual:** 成長していく子供のイメージ、または機能拡張のアイコン。

### 9. Team
*   **Text:**
    *   Roles & Members
*   **Visual:** メンバー写真、役割。

### 10. End
*   **Text:**
    *   Curiosity's Best Friend.
    *   **Kids Science Lab**
*   **Visual:** 大きなロゴ、デモURLのQRコード。
