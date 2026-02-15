# アーキテクチャ解説動画ストーリーボード構成案 (Part 4: The Technology)

## 目的
ハッカソンの審査員（技術者含む）に向けて、Kids Science Labの技術的な先進性、工夫、実装の堅牢さをアピールする。特に「子供を待たせないスピード」と「親への高度なアドバイス」の両立を実現したアーキテクチャを強調する。

## ベースとなる構成 (from video_composition_plan.md)
*   **Part 4: The Technology (技術スタック)**
    *   BGM: 知的でクールな、テック系のBGM
    *   Scene 12: Google Cloud × Agentic AI (システム構成図)
    *   Scene 13: Gemini 2.5 Flash (低遅延)
    *   Scene 14: ReAct Agent (自律的な思考)
    *   Scene 15: Cloud Run (Parallel Generation)

## 詳細ストーリーボード案

| シーン番号 | 時間 (目安) | 画面イメージ・構成 | ナレーション・テロップ | 素材・備考 |
| :--- | :--- | :--- | :--- | :--- |
| **Tech-1** | 0:00-0:05 | **システム全体像**<br>画面中央にシステム構成図を表示。<br>Client (Next.js), Server Actions, GCP (Gemini, Imagen, TTS) の関係性を見せる。<br>特に「Orchestrator-Workersパターン」を強調。 | **[テロップ]**<br>Google Cloud × Agentic AI<br>Orchestrator-Workers Architecture<br><br>**[ナレーション]**<br>裏側では、Google Cloudと最新のAgentic AI技術が動いています。<br>7人の専門家エージェントを束ねるオーケストレーター構成を採用。 | **素材:**<br>`plans/assets/scene_12_architecture.png`<br>(または記事内のMermaid図をリデザインしたもの) |
| **Tech-2** | 0:05-0:10 | **Gemini 2.5 Flash & 低遅延**<br>Geminiのロゴと稲妻エフェクト。<br>「Latency」のグラフがガクンと下がるイメージや、時計の針がゆっくりになる演出。<br>「1.5 Pro vs 2.5 Flash」の比較など。 | **[テロップ]**<br>Powered by Gemini 2.5 Flash<br>圧倒的な低遅延 (Low Latency)<br><br>**[ナレーション]**<br>モデルにはGemini 2.5 Flashを採用。<br>子供の好奇心を逃さない、圧倒的なレスポンススピードを実現しました。 | **素材:**<br>`plans/assets/scene_13_gemini_flash.png`<br>Geminiロゴ |
| **Tech-3** | 0:10-0:18 | **並列生成パイプライン (Parallel Generation)**<br>シーケンシャルな処理（Text→Image→Audio）と、パラレルな処理（Text + Image + Audio）の比較アニメーション。<br>タイムラインバーが短縮される様子。 | **[テロップ]**<br>Parallel Generation Pipeline<br>並列生成によるUX最適化<br><br>**[ナレーション]**<br>さらに、テキスト生成の裏で画像と音声を並列に生成。<br>「待ち時間」を極限までゼロに近づけています。 | **素材:**<br>`plans/assets/scene_15_cloud_run.png` (流用)<br>新規作成: パイプライン比較図 |
| **Tech-4** | 0:18-0:28 | **ReAct Agent (Parent Advisor)**<br>親エージェントが「思考」している様子。<br>Thought（思考）→ Action（ツール実行）→ Observation（結果）のサイクルを図解。<br>具体的なログ（「恐竜に興味がある…」）を解析している画面。 | **[テロップ]**<br>ReAct Agent for Parents<br>自律的な思考と提案<br><br>**[ナレーション]**<br>親へのアドバイスは、ReActパターンを用いたエージェントが担当。<br>会話ログを分析し、「今、何を話すべきか」を自律的に思考して提案します。 | **素材:**<br>`plans/assets/scene_14_react_agent.png`<br>`output/web-articles/assets/react_process_flow.png` (記事内の図) |
| **Tech-5** | 0:28-0:35 | **Tech Stack Summary**<br>使用技術のアイコン一覧。<br>Next.js, Firebase, Cloud Run, Vertex AI。<br>最後に「Next.js 16 Server Actions」をハイライト。 | **[テロップ]**<br>Built with Modern Stack<br>Next.js 16 + Firebase + Vertex AI<br><br>**[ナレーション]**<br>Next.js 16のServer ActionsとFirebaseを組み合わせ、<br>セキュアかつスケーラブルな基盤を構築しました。 | **素材:**<br>技術アイコン一覧<br>(Next.js, Firebase, Google Cloud, etc.) |

## 必要な素材リスト

1.  **システム構成図 (Architecture Diagram)**: 記事内のMermaid図をベースに、動画で見やすいように配色・配置を調整したもの。
2.  **パイプライン比較図 (Pipeline Comparison)**: シリアル処理 vs パラレル処理の違いがわかる図。
3.  **ReActプロセスの図**: 思考→行動→観察のサイクルがわかる図。記事内の `react_process_flow.png` が使えそう。
4.  **技術スタックアイコン**: Next.js, Firebase, Google Cloud, Gemini, Vertex AI などのロゴ。

## 確認事項
*   各シーンの秒数は適切か？（全体で35秒程度を想定）
*   強調したいポイント（低遅延、ReActなど）はこれで網羅できているか？
*   素材は既存のもの (`plans/assets/` や `output/web-articles/assets/`) で足りるか、新規作成が必要か？
