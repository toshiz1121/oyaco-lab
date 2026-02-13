"use server";

import { decideAgent, generateExpertResponse, generateIllustration, generateCombinedImagePrompt, createSentenceImagePairs, educatorReview, generateFollowUpQuestions, ExplanationStyle } from "@/lib/agents/core";
import { AgentResponse, AgentRole, AgentPipelineMetadata } from "@/lib/agents/types";
import { generateSpeech } from "@/lib/vertexai";
import { agents } from "@/lib/agents/definitions";

// 相談結果の型定義
export interface ConsultationResult {
  success: boolean;
  data?: AgentResponse;
  error?: string;
}

// エージェント決定結果の型定義
export interface AgentDecisionResult {
  success: boolean;
  agentId?: AgentRole;
  selectionReason?: string;
  error?: string;
}

/**
 * 質問に対して最適な専門家を決定するアクション
 * 
 * この関数は博士の選定のみを行い、すぐに結果を返します。
 * UIはこの結果を受け取った瞬間にスポットライト演出を開始できます。
 * 
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @returns 選ばれた博士のIDと選定理由
 */
export async function decideAgentAction(
  question: string,
  history: { role: string, content: string }[] = []
): Promise<AgentDecisionResult> {
  try {
    console.log(`[decideAgentAction] エージェントを選択中: "${question}"`);
    
    const { agentId, reason: selectionReason } = await decideAgent(question, history);
    
    console.log(`[decideAgentAction] 選択されたエージェント: ${agentId}, 理由: ${selectionReason}`);
    
    return {
      success: true,
      agentId,
      selectionReason
    };
  } catch (error) {
    console.error("[decideAgentAction] 失敗しました:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Agent decision failed"
    };
  }
}

/**
 * 選ばれた専門家が回答を生成するアクション
 * 
 * decideAgentActionで選ばれた博士が、実際に回答と画像を生成します。
 * この処理は時間がかかるため、UIは画像生成中の画面を表示します。
 * 
 * @param agentId 選ばれた博士のID
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @param style 説明スタイル
 * @returns エージェントの回答データ
 */
export async function generateResponseAction(
  agentId: AgentRole,
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[generateResponseAction] ${agentId}の回答を生成中`);
    const pipelineStart = Date.now();

    // ステップ1: エキスパート回答を生成（これは後続すべての入力になるので直列）
    console.log(`[DEBUG] ステップ1: ${agentId}のエキスパート回答を生成中...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] 生成されたテキスト: ${responseData.text.slice(0, 50)}...`);

    const initialSteps = responseData.steps || [];

    // ステップ2: レビュー・深掘り質問・画像・音声を最大限並列実行
    // educatorReviewのプロンプトでvisualDescriptionは変更不可と指示しているため、
    // 画像生成はレビュー完了を待たずに開始できる
    console.log(`[DEBUG] ステップ2: レビュー + 深掘り質問 + 画像 + 音声を並列実行...`);

    const combinedPrompt = initialSteps.length > 0
      ? generateCombinedImagePrompt(initialSteps)
      : null;

    // 並列タスクを構築
    const reviewPromise = agentId !== 'educator'
      ? educatorReview(agentId, question, responseData.text, initialSteps)
      : Promise.resolve(null);

    const followUpPromise = generateFollowUpQuestions(agentId, question, responseData.text, initialSteps);

    const imagePromise = combinedPrompt
      ? generateIllustration(combinedPrompt)
      : Promise.resolve(undefined);

    const audioPromise = initialSteps.length > 0
      ? generateSpeech(initialSteps[0].text, agents[agentId].voiceName)
      : Promise.resolve(null);

    // 全タスクを並列実行
    const [reviewResult, followUpQuestions, imageUrl, audioData] = await Promise.all([
      reviewPromise,
      followUpPromise,
      imagePromise,
      audioPromise,
    ]);

    // レビュー結果を反映（テキストのみ。visualDescriptionは変更されない）
    let finalText = responseData.text;
    let finalSteps = initialSteps;
    if (reviewResult && !reviewResult.approved && reviewResult.revisedSteps) {
      console.log(`[DEBUG] Educatorが回答を修正しました`);
      finalText = reviewResult.revisedText || finalText;
      finalSteps = reviewResult.revisedSteps;
    }

    // 文章-画像ペアを構築
    const pairs = createSentenceImagePairs(finalSteps);
    console.log(`[DEBUG] ${pairs.length}個の文章-画像ペアを作成しました`);

    let combinedImageUrl: string | undefined;
    if (pairs.length > 0) {
      if (imageUrl) {
        combinedImageUrl = imageUrl;
        pairs.forEach(p => {
          p.imageUrl = imageUrl;
          p.status = 'ready';
          p.generatedAt = new Date().toISOString();
        });
        console.log(`[DEBUG] 4パネル結合画像の生成に成功しました`);
      } else {
        pairs.forEach(p => p.status = 'error');
        console.error(`[ERROR] 結合画像の生成がnullを返しました`);
      }

      // 最初のペアの音声データを設定
      pairs[0].audioData = audioData;
      console.log(`[DEBUG] 最初のペアの音声: ${audioData ? '生成成功' : '失敗（フォールバックを使用）'}`);
    }

    // パイプラインメタデータを構築
    const pipelineMetadata: AgentPipelineMetadata = {
      selectedAgent: agentId,
      selectionReason: '',
      educatorReview: reviewResult ? {
        approved: reviewResult.approved,
        feedback: reviewResult.feedback,
      } : undefined,
      processingTimeMs: Date.now() - pipelineStart,
    };

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: finalText,
      pairs,
      combinedImageUrl,
      audioUrl: undefined,
      isThinking: false,
      useParallelGeneration: true,
      agentPipeline: pipelineMetadata,
      followUpQuestions,
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("[generateResponseAction] 失敗しました:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Response generation failed"
    };
  }
}

/**
 * テキストを音声に変換するサーバーアクション
 * 
 * Vertex AI TTSを使用して音声を生成します。
 * 失敗した場合はnullを返し、クライアント側でWeb Speech APIにフォールバックします。
 * 
 * @param text 読み上げるテキスト
 * @param agentId エージェントID（音声選択用）
 * @returns Base64エンコードされた音声データ、または失敗時はnull
 */
export async function generateSpeechAction(text: string, agentId: AgentRole = 'educator'): Promise<string | null> {
  try {
    console.log(`generateSpeechAction が呼ばれました。テキスト長: ${text.length}, エージェント: ${agentId}`);
    const voiceName = agents[agentId].voiceName;
    const base64Audio = await generateSpeech(text, voiceName);
    return base64Audio;
  } catch (error: any) {
    console.error("サーバーアクションでの音声生成に失敗しました:", error);
    // Vertex AI TTSが利用できない場合はnullを返す
    // クライアント側でWeb Speech APIにフォールバックする
    console.warn("Vertex AI TTSが利用できません。クライアントはWeb Speech APIフォールバックを使用します。");
    return null;
  }
}

/**
 * 個別の画像を生成するサーバーアクション
 * 
 * 並列文章-画像生成フローで使用されます。
 * フロントエンドが必要に応じて特定のペアの画像をリクエストします。
 * 失敗時は自動的にリトライを行います（最大3回試行）。
 * 
 * @param pairId ペアの一意識別子（ログ用）
 * @param visualDescription 画像生成用の英語プロンプト
 * @returns 画像URLとステータス（ready または error）
 */
export async function generateNextImageAction(
  pairId: string,
  visualDescription: string
): Promise<{ imageUrl: string | null; status: 'ready' | 'error' }> {
  const maxRetries = 2; // 最大2回リトライ（合計3回試行）
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DEBUG] ${pairId}の画像を生成中、試行 ${attempt + 1}/${maxRetries + 1}`);
      
      const imageUrl = await generateIllustration(visualDescription);
      
      if (imageUrl) {
        console.log(`[DEBUG] ${pairId}の画像生成に成功しました`);
        return {
          imageUrl,
          status: 'ready'
        };
      }
      
      // imageUrlがnullの場合もリトライ対象
      console.warn(`[WARN] ${pairId}の画像生成がnullを返しました、試行 ${attempt + 1}`);
      
      if (attempt < maxRetries) {
        // 指数バックオフで待機時間を増やす（4秒、8秒）
        const delay = Math.pow(2, attempt + 2) * 1000;
        console.log(`[DEBUG] ${delay}ms後にリトライします...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      console.error(`[ERROR] ${pairId}の画像生成に失敗しました、試行 ${attempt + 1}:`, error);
      
      if (attempt < maxRetries) {
        // 指数バックオフで待機時間を増やす（4秒、8秒）
        const delay = Math.pow(2, attempt + 2) * 1000;
        console.log(`[DEBUG] ${delay}ms後にリトライします...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // すべてのリトライが失敗した場合
  console.error(`[ERROR] ${pairId}のすべてのリトライ試行が失敗しました`);
  return {
    imageUrl: null,
    status: 'error'
  };
}

/**
 * 1ステップ分の音声と画像をセットで順次生成するサーバーアクション
 * 
 * TTS → 画像の順に生成する。TTSを先に生成することで、
 * 音声再生を早く開始でき、画像は音声再生中に表示される。
 * レート制限を避けるため、並列ではなく順次実行する。
 */
export async function generateNextPairAudioAction(
  pairId: string,
  text: string,
  agentId: AgentRole,
): Promise<string | null> {
  console.log(`[PairGen] ${pairId}: 音声生成を開始 (エージェント: ${agentId})`);
  try {
    const voiceName = agents[agentId].voiceName;
    const audioData = await generateSpeech(text, voiceName);
    console.log(`[PairGen] ${pairId}: 音声生成 ${audioData ? '成功' : '失敗'}`);
    return audioData;
  } catch (error) {
    console.error(`[PairGen] ${pairId}: 音声生成エラー:`, error);
    return null;
  }
}

