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

export interface AgentResponse {
  agentId: AgentRole;
  text: string; // Main answer or summary
  steps?: ExplanationStep[]; // Stepwise explanation
  imageUrl?: string; // Generated illustration
  audioUrl?: string; // Generated speech
  isThinking?: boolean;
  selectionReason?: string; // 子供向けの専門家選定理由
}
