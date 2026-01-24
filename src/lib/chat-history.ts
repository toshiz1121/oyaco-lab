/**
 * Chat History Management
 * 
 * エージェントとの対話履歴を管理・永続化するモジュール
 * LocalStorageを使用
 */

import { AgentRole } from './agents/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  
  // アシスタントの回答に関連するメタデータ
  agentId?: AgentRole;
  agentName?: string;
  
  // マルチメディア要素
  imageUrl?: string;
  audioUrl?: string;
  
  // 文脈情報（説明スタイルなど）
  style?: string;
  
  // ユーザーのフィードバック（将来用）
  isLiked?: boolean;
}

export interface ChatSession {
  id: string;
  title: string; // 最初の質問などをタイトルにする
  startTime: number;
  lastUpdated: number;
  messages: ChatMessage[];
  
  // 分析用タグ（トピックなど）
  topics?: string[];
}

const STORAGE_KEY = 'kids_science_chat_history';
const MAX_SESSIONS = 20;

/**
 * LocalStorageが利用可能かチェック
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 全セッションを取得
 */
export function getAllSessions(): ChatSession[] {
  if (!isLocalStorageAvailable()) return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const sessions = JSON.parse(data) as ChatSession[];
    return sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
}

/**
 * セッションを保存
 */
function saveSessions(sessions: ChatSession[]): void {
  if (!isLocalStorageAvailable()) return;
  
  try {
    // 最大件数制限
    const trimmedSessions = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedSessions));
  } catch (error) {
    // QuotaExceededError handling
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn('Storage quota exceeded. Attempting to recover...');
        
        try {
            // 戦略1: セッション数を減らして再試行 (最新5件のみ)
            const reducedSessions = sessions.slice(0, 5);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedSessions));
            console.log('History saved with reduced session count.');
            return;
        } catch (retryError) {
            // 戦略2: 画像データを削除して保存 (テキストのみ保存)
            try {
                const noImageSessions = sessions.slice(0, 10).map(s => ({
                    ...s,
                    messages: s.messages.map(m => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { imageUrl, ...rest } = m;
                        return rest;
                    })
                }));
                localStorage.setItem(STORAGE_KEY, JSON.stringify(noImageSessions));
                console.log('History saved without images due to size limits.');
                return;
            } catch (finalError) {
                console.error('Critical: Failed to save history even after compression.', finalError);
            }
        }
    }
    console.error('Failed to save chat history:', error);
  }
}

/**
 * 新しいセッションを作成
 */
export function createSession(initialQuestion: string): ChatSession {
  const sessions = getAllSessions();
  
  const newSession: ChatSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: initialQuestion.length > 20 ? initialQuestion.substring(0, 20) + '...' : initialQuestion,
    startTime: Date.now(),
    lastUpdated: Date.now(),
    messages: [],
    topics: [] // 後で分析して埋める想定
  };
  
  sessions.unshift(newSession);
  saveSessions(sessions);
  
  return newSession;
}

/**
 * メッセージを追加
 */
export function addMessageToSession(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatSession | null {
  const sessions = getAllSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) return null;
  
  const newMessage: ChatMessage = {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now()
  };
  
  sessions[sessionIndex].messages.push(newMessage);
  sessions[sessionIndex].lastUpdated = Date.now();
  
  // 最新のセッションを先頭に移動
  const updatedSession = sessions[sessionIndex];
  sessions.splice(sessionIndex, 1);
  sessions.unshift(updatedSession);
  
  saveSessions(sessions);
  
  return updatedSession;
}

/**
 * セッションを取得
 */
export function getSession(sessionId: string): ChatSession | null {
  const sessions = getAllSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * 履歴をクリア
 */
export function clearChatHistory(): void {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * 統計情報の取得（親向けレポート用）
 */
export function getChatStats() {
  const sessions = getAllSessions();
  
  const totalQuestions = sessions.reduce((acc, session) => {
    return acc + session.messages.filter(m => m.role === 'user').length;
  }, 0);
  
  const agentCounts: Record<string, number> = {};
  sessions.forEach(session => {
    session.messages.forEach(msg => {
      if (msg.role === 'assistant' && msg.agentId) {
        agentCounts[msg.agentId] = (agentCounts[msg.agentId] || 0) + 1;
      }
    });
  });
  
  return {
    totalSessions: sessions.length,
    totalQuestions,
    agentCounts,
    lastActivity: sessions.length > 0 ? sessions[0].lastUpdated : null
  };
}
