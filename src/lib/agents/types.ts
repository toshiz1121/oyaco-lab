export type AgentRole = 'orchestrator' | 'scientist' | 'biologist' | 'astronomer' | 'historian' | 'artist' | 'engineer' | 'educator';

export interface Agent {
  id: AgentRole;
  name: string;
  nameJa: string;
  avatar: string;    // URL or path
  persona: string;   // System prompt（口調・性格）
  style: string;     // Description of speaking style or visual style
  color: string;     // UI theme color
  expertise: string[];    // 得意な分野キーワード
  cannotHandle: string[]; // 専門外の分野キーワード
}

export interface ExplanationStep {
  stepNumber: number;
  text: string;
  visualDescription: string;
}

export type PairStatus = 'pending' | 'generating' | 'ready' | 'error';

export interface SentenceImagePair {
  id: string;                    // 一意識別子（例: "pair-1", "pair-2"）
  stepNumber: number;            // 1から始まる連番
  text: string;                  // 日本語の説明文
  visualDescription: string;     // 英語の画像生成プロンプト
  imageUrl: string | null;       // 生成された画像URL（未生成時はnull）
  audioData: string | null;      // Base64エンコードされた音声データ（未生成時はnull）
  status: PairStatus;            // 現在の生成ステータス
  generatedAt?: string;           // 画像生成完了時刻（ISO文字列）
}

/**
 * educator レビュー結果
 * educator が他の博士の回答を「子供にとって適切か」判断した結果
 */
export interface EducatorReview {
  approved: boolean;           // 修正不要なら true
  revisedSteps?: ExplanationStep[]; // 修正後のステップ（approved=false の場合）
  revisedText?: string;        // 修正後の要約テキスト
  feedback: string;            // educator からのフィードバック（ログ用）
}

/**
 * エージェントパイプラインのメタデータ
 * 処理の流れを記録し、親ダッシュボードで確認可能にする
 */
export interface AgentPipelineMetadata {
  selectedAgent: AgentRole;
  selectionReason: string;
  educatorReview?: {
    approved: boolean;
    feedback: string;
  };
  processingTimeMs: number;
}

/**
 * 深掘り質問候補
 * エキスパートが回答内容を分析し、子供の好奇心を連鎖させる次の質問を提案
 */
export interface FollowUpQuestion {
  question: string;        // 子供向けの質問文
  suggestedAgent: AgentRole; // この質問に答えるのに最適な博士
  emoji: string;           // 質問のアイコン（例: 🔬, 🌍, 🎨）
}

export interface AgentResponse {
  agentId: AgentRole;
  text: string; // Main answer or summary
  steps?: ExplanationStep[]; // Stepwise explanation (旧フロー用 - 後方互換性)
  imageUrl?: string; // Generated illustration (旧フロー用 - 後方互換性)
  audioUrl?: string; // Generated speech
  isThinking?: boolean;
  selectionReason?: string; // 子供向けの専門家選定理由

  // 新フロー用
  pairs?: SentenceImagePair[];   // 文章画像ペアの配列
  combinedImageUrl?: string;     // 4パネル結合画像URL（全ステップ共通）
  useParallelGeneration?: boolean; // どちらのフローを使用したか
  agentPipeline?: AgentPipelineMetadata; // パイプラインメタデータ
  followUpQuestions?: FollowUpQuestion[]; // 深掘り質問候補
}
