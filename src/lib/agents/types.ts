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

export interface AgentResponse {
  agentId: AgentRole;
  text: string; // Main answer
  imageUrl?: string; // Generated illustration
  audioUrl?: string; // Generated speech
  isThinking?: boolean;
}
