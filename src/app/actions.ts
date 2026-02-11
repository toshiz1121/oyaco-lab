"use server";

import { decideAgent, generateExpertResponse, generateIllustrationPrompt, generateIllustration, generateCombinedImagePrompt, createSentenceImagePairs, educatorReview, generateFollowUpQuestions, ExplanationStyle } from "@/lib/agents/core";
import { AgentResponse, AgentRole, AgentPipelineMetadata, FollowUpQuestion } from "@/lib/agents/types";
import { generateSpeech } from "@/lib/vertexai";

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
 * 質問に対して最適な専門家を決定するアクション（高速）
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

    // 環境変数から並列生成機能の有効/無効を判定
    const useParallelGeneration = process.env.USE_PARALLEL_GENERATION === 'true';
    console.log(`[DEBUG] USE_PARALLEL_GENERATION: ${useParallelGeneration}`);

    if (!useParallelGeneration) {
      // 並列生成が無効の場合は従来の逐次処理フローを使用
      return await legacyGenerateResponse(agentId, question, history, style);
    }

    // 並列生成フロー
    console.log(`[DEBUG] 並列生成フローを使用します`);

    // ステップ1: 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] ステップ1: ${agentId}のエキスパート回答を生成中...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] 生成されたテキスト: ${responseData.text.slice(0, 50)}...`);

    // ステップ2: educator レビュー + 深掘り質問を並列実行
    let finalText = responseData.text;
    let finalSteps = responseData.steps || [];
    let reviewResult;
    let followUpQuestions: FollowUpQuestion[] = [];

    if (agentId !== 'educator') {
      console.log(`[DEBUG] ステップ2: Educatorレビュー + 深掘り質問（並列実行）...`);
      const [review, followUps] = await Promise.all([
        // 生成された専門家の解説を評価する処理
        educatorReview(agentId, question, responseData.text, finalSteps),

        // 深掘りする質問を生成する処理
        generateFollowUpQuestions(agentId, question, responseData.text, finalSteps),
      ]);
      reviewResult = review;
      followUpQuestions = followUps;

      // レビューで承認されなかった場合
      if (!reviewResult.approved && reviewResult.revisedSteps) {
        console.log(`[DEBUG] Educatorが回答を修正しました`);
        // 修正された内容で上書きを行う
        finalText = reviewResult.revisedText || finalText;
        finalSteps = reviewResult.revisedSteps;
      }
    } else {
      // educator 自身の回答には深掘り質問だけ生成
      followUpQuestions = await generateFollowUpQuestions(agentId, question, responseData.text, finalSteps);
    }

    // 説明文を文章-画像ペアの配列に変換
    const pairs = createSentenceImagePairs(finalSteps);
    console.log(`[DEBUG] ${pairs.length}個の文章-画像ペアを作成しました`);

    // 4パネル結合画像1枚 + 最初のペアの音声を並列生成
    let combinedImageUrl: string | undefined;
    if (pairs.length > 0) {
      console.log(`[DEBUG] ステップ3: 4パネル結合画像 + 最初のペアの音声を並列生成中...`);
      pairs.forEach(p => p.status = 'generating');
      
      try {
        const combinedPrompt = generateCombinedImagePrompt(finalSteps);
        console.log(`[DEBUG] 結合画像プロンプト: ${combinedPrompt.slice(0, 100)}...`);

        const [imageUrl, audioData] = await Promise.all([
          generateIllustration(combinedPrompt),
          generateSpeech(pairs[0].text)
        ]);
        
        if (imageUrl) {
          combinedImageUrl = imageUrl;
          // 全ペアに同じ結合画像URLを設定（UIの互換性のため）
          pairs.forEach(p => {
            p.imageUrl = imageUrl;
            p.status = 'ready';
            p.generatedAt = new Date();
          });
          console.log(`[DEBUG] 4パネル結合画像の生成に成功しました`);
        } else {
          pairs.forEach(p => p.status = 'error');
          console.error(`[ERROR] 結合画像の生成がnullを返しました`);
        }
        
        // 最初のペアの音声データを設定
        pairs[0].audioData = audioData;
        console.log(`[DEBUG] 最初のペアの音声: ${audioData ? '生成成功' : '失敗（フォールバックを使用）'}`);
        
      } catch (error) {
        console.error('[ERROR] 結合画像・音声の生成に失敗しました:', error);
        pairs.forEach(p => { if (p.status === 'generating') p.status = 'error'; });
      }
    }

    // パイプラインメタデータを構築
    const pipelineMetadata: AgentPipelineMetadata = {
      selectedAgent: agentId,   // どのエージェントが
      selectionReason: '', // decideAgentAction で設定済み、ここでは空
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
 * 従来の逐次生成フロー（generateResponseAction用）
 */
async function legacyGenerateResponse(
  agentId: AgentRole,
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[DEBUG] レガシーの逐次フローを使用して回答を生成します`);

    // ステップ1: 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] ステップ1: ${agentId}のエキスパート回答を生成中...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] 生成されたテキスト: ${responseData.text.slice(0, 50)}...`);

    // ステップ2: 画像生成用のプロンプトを作成
    let imagePrompt: string;
    if (responseData.steps && responseData.steps.length > 0) {
      imagePrompt = generateCombinedImagePrompt(responseData.steps);
    } else {
      imagePrompt = await generateIllustrationPrompt(agentId, question, responseData.text);
    }
    console.log(`画像プロンプト: ${imagePrompt}`);

    // ステップ3: 画像を生成
    console.log(`[DEBUG] ステップ2: イラストを生成中...`);
    const imageUrl = await generateIllustration(imagePrompt);
    console.log(`[DEBUG] イラスト生成: ${imageUrl ? '成功' : '失敗'}`);

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      steps: responseData.steps,
      imageUrl,
      audioUrl: undefined,
      isThinking: false,
      useParallelGeneration: false
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("レガシー回答生成に失敗しました:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Response generation failed"
    };
  }
}

/**
 * 子供の質問に対してAIエージェントが回答を生成するメインアクション（レガシー版）
 * 
 * 後方互換性のために残していますが、新しいコードでは
 * decideAgentAction + generateResponseAction の2段階呼び出しを推奨します。
 * 
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @param style 説明スタイル（デフォルト、詳細など）
 * @returns 成功/失敗とエージェントの回答データ
 * @deprecated 代わりに decideAgentAction と generateResponseAction を使用してください
 */
export async function consultAction(
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[consultAction] 非推奨: 代わりにdecideAgentAction + generateResponseActionを使用してください`);
    console.log(`相談を開始しました: "${question}" (スタイル: ${style})`);

    // 環境変数から並列生成機能の有効/無効を判定
    const useParallelGeneration = process.env.USE_PARALLEL_GENERATION === 'true';
    console.log(`[DEBUG] USE_PARALLEL_GENERATION: ${useParallelGeneration}`);

    if (!useParallelGeneration) {
      // 並列生成が無効の場合は従来の逐次処理フローを使用
      return await sequentialConsultFlow(question, history, style);
    }

    /**
     * 
     *  並列生成フロー: 文章と画像を段階的に生成
     * 
     */

    // 質問内容に最適な専門家エージェントを選択
    console.log(`[DEBUG] ステップ1: エージェントを選択中...`);
    const { agentId, reason: selectionReason } = await decideAgent(question, history);
    console.log(`[DEBUG] 選択されたエージェント: ${agentId}, 理由: ${selectionReason}`);

    // 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] ステップ2: ${agentId}のエキスパート回答を生成中...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] 生成されたテキスト: ${responseData.text.slice(0, 50)}...`);

    // 説明文を文章-画像ペアの配列に変換
    const pairs = createSentenceImagePairs(responseData.steps || []);
    console.log(`[DEBUG] ${pairs.length}個の文章-画像ペアを作成しました`);

    // ステップ4: 4パネル結合画像1枚 + 最初のペアの音声を並列生成
    let combinedImageUrl: string | undefined;
    if (pairs.length > 0) {
      console.log(`[DEBUG] 4パネル結合画像 + 最初のペアの音声を並列生成中...`);
      pairs.forEach(p => p.status = 'generating');
      
      try {

        /**
         * 
         * 4パネル結合画像1枚と最初のペアの音声を並列生成してレスポンス時間を短縮
         * 
         */
        const combinedPrompt = generateCombinedImagePrompt(responseData.steps || []);
        
        const [imageUrl, audioData] = await Promise.all([
          generateIllustration(combinedPrompt),
          generateSpeech(pairs[0].text)
        ]);
        
        if (imageUrl) {
          combinedImageUrl = imageUrl;
          // 全ペアに同じ結合画像URLを設定
          pairs.forEach(p => {
            p.imageUrl = imageUrl;
            p.status = 'ready';
            p.generatedAt = new Date();
          });
          console.log(`[DEBUG] 4パネル結合画像の生成に成功しました`);
        } else {
          pairs.forEach(p => p.status = 'error');
          console.error(`[ERROR] 結合画像の生成がnullを返しました`);
        }
        
        // 音声データを設定（nullでも許容、クライアント側でフォールバック）
        pairs[0].audioData = audioData;
        console.log(`[DEBUG] 最初のペアの音声: ${audioData ? '生成成功' : '失敗（フォールバックを使用）'}`);
        
      } catch (error) {
        console.error('[ERROR] 結合画像・音声の生成に失敗しました:', error);
        pairs.forEach(p => { if (p.status === 'generating') p.status = 'error'; });
      }
    }

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      pairs,
      combinedImageUrl,
      audioUrl: undefined,
      isThinking: false,
      selectionReason,
      useParallelGeneration: true
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("相談に失敗しました:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Consultation failed"
    };
  }
}

/**
 * 従来の逐次生成フロー（後方互換性のため保持）
 * 
 * 処理の流れ:
 * 1. エージェント選択
 * 2. 説明文生成
 * 3. 画像プロンプト生成
 * 4. 画像生成（1枚のみ）
 * 
 * @param question 子供からの質問文
 * @param history 過去の会話履歴
 * @param style 説明スタイル
 * @returns 成功/失敗とエージェントの回答データ
 */
async function sequentialConsultFlow(
  question: string,
  history: { role: string, content: string }[] = [],
  style: ExplanationStyle = 'default'
): Promise<ConsultationResult> {
  try {
    console.log(`[DEBUG] 逐次フローを使用します`);

    // ステップ1: 質問内容に最適な専門家エージェントを選択
    console.log(`[DEBUG] ステップ1: エージェントを選択中...`);
    const { agentId, reason: selectionReason } = await decideAgent(question, history);
    console.log(`[DEBUG] 選択されたエージェント: ${agentId}, 理由: ${selectionReason}`);

    // ステップ2: 選択されたエージェントが説明文を生成
    console.log(`[DEBUG] ステップ2: ${agentId}のエキスパート回答を生成中...`);
    const responseData = await generateExpertResponse(agentId, question, history, style);
    console.log(`[DEBUG] 生成されたテキスト: ${responseData.text.slice(0, 50)}...`);

    // ステップ3: 画像生成用のプロンプトを作成
    let imagePrompt: string;
    if (responseData.steps && responseData.steps.length > 0) {
      // 複数ステップがある場合は統合プロンプトを生成
      imagePrompt = generateCombinedImagePrompt(responseData.steps);
    } else {
      // ステップがない場合は従来の方法でプロンプト生成（非推奨）
      imagePrompt = await generateIllustrationPrompt(agentId, question, responseData.text);
    }
    console.log(`画像プロンプト: ${imagePrompt}`);

    // ステップ4: 画像を生成
    console.log(`[DEBUG] ステップ3: イラストを生成中...`);
    const imageUrl = await generateIllustration(imagePrompt);
    console.log(`[DEBUG] イラスト生成: ${imageUrl ? '成功' : '失敗'}`);

    // レスポンスオブジェクトを構築
    const response: AgentResponse = {
      agentId,
      text: responseData.text,
      steps: responseData.steps,
      imageUrl,
      audioUrl: undefined,
      isThinking: false,
      selectionReason,
      useParallelGeneration: false
    };

    return { success: true, data: response };

  } catch (error) {
    console.error("レガシー相談に失敗しました:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Consultation failed"
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
 * @returns Base64エンコードされた音声データ、または失敗時はnull
 */
export async function generateSpeechAction(text: string): Promise<string | null> {
  try {
    console.log(`generateSpeechAction が呼ばれました。テキスト長: ${text.length}`);
    // Vertex AI TTSで音声を生成（デフォルトボイス: charon）
    const base64Audio = await generateSpeech(text);
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
): Promise<string | null> {
  console.log(`[PairGen] ${pairId}: 音声生成を開始`);
  try {
    const audioData = await generateSpeech(text);
    console.log(`[PairGen] ${pairId}: 音声生成 ${audioData ? '成功' : '失敗'}`);
    return audioData;
  } catch (error) {
    console.error(`[PairGen] ${pairId}: 音声生成エラー:`, error);
    return null;
  }
}

export async function generateNextPairImageAction(
  pairId: string,
  visualDescription: string,
): Promise<{ imageUrl: string | null; status: 'ready' | 'error' }> {
  console.log(`[PairGen] ${pairId}: 画像生成を開始`);
  try {
    const result = await generateIllustration(visualDescription);
    if (result) {
      console.log(`[PairGen] ${pairId}: 画像生成成功`);
      return { imageUrl: result, status: 'ready' };
    }
  } catch (error) {
    console.error(`[PairGen] ${pairId}: 画像生成エラー:`, error);
  }
  return { imageUrl: null, status: 'error' };
}
