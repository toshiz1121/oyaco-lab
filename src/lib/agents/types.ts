export type AgentRole = 'orchestrator' | 'scientist' | 'biologist' | 'astronomer' | 'historian' | 'artist' | 'educator';

export interface Agent {
  id: AgentRole;
  name: string;
  nameJa: string;
  avatar: string; // URL or path
  persona: string; // System prompt
  style: string; // Description of speaking style or visual style
  color: string; // UI theme color
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
  generatedAt?: Date;            // 画像生成完了時刻
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
  useParallelGeneration?: boolean; // どちらのフローを使用したか
}
