/**
 * Chat History Management
 * 
 * エージェントとの対話履歴を管理・永続化するモジュール
 * LocalStorageを使用
 */

import { AgentRole, ExplanationStep, SentenceImagePair } from './agents/types';

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
  
  // ステップ分割回答（オプション）
  steps?: ExplanationStep[];
  
  // 新フロー用: 文章画像ペア
  pairs?: SentenceImagePair[];
  useParallelGeneration?: boolean;

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
    console.error('チャット履歴の読み込みに失敗:', error);
    return [];
  }
}

/**
 * セッションを保存
 * 
 * LocalStorageの容量制限（約5MB）を超えた場合は、
 * 段階的にデータを圧縮して保存を試みる
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
        console.warn('ストレージ容量超過。復旧を試みます...');
        
        try {
            // 戦略1: セッション数を減らして再試行 (最新5件のみ)
            const reducedSessions = sessions.slice(0, 5);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedSessions));
            console.log('セッション数を削減して履歴を保存しました。');
            return;
        } catch (retryError) {
            // 戦略2: 画像・音声データを削除して保存 (テキストのみ保存)
            try {
                const compressedSessions = sessions.slice(0, 10).map(s => ({
                    ...s,
                    messages: s.messages.map(m => {
                        // メッセージから大きなデータを削除
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { imageUrl, audioUrl, ...rest } = m;
                        
                        // pairs内の画像・音声データも削除
                        if (rest.pairs) {
                            rest.pairs = rest.pairs.map(p => ({
                                ...p,
                                imageUrl: null,  // 画像データを削除
                                audioData: null  // 音声データを削除
                            }));
                        }
                        
                        // steps内のvisualDescriptionは残す（テキストなので小さい）
                        return rest;
                    })
                }));
                localStorage.setItem(STORAGE_KEY, JSON.stringify(compressedSessions));
                console.log('容量制限のため、画像・音声なしで履歴を保存しました。');
                return;
            } catch (secondRetryError) {
                // 戦略3: 最新3件のみ、テキストだけ保存
                try {
                    const minimalSessions = sessions.slice(0, 3).map(s => ({
                        ...s,
                        messages: s.messages.map(m => ({
                            id: m.id,
                            role: m.role,
                            content: m.content,
                            timestamp: m.timestamp,
                            agentId: m.agentId
                        }))
                    }));
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalSessions));
                    console.log('最小限のデータ（テキストのみ）で履歴を保存しました。');
                    return;
                } catch (finalError) {
                    // 戦略4: 履歴をクリアして新規保存
                    console.error('致命的: 全ての復旧試行が失敗しました。古い履歴をクリアします。');
                    localStorage.removeItem(STORAGE_KEY);
                    
                    // 最新のセッションのみ保存を試みる
                    if (sessions.length > 0) {
                        const latestOnly = [{
                            ...sessions[0],
                            messages: sessions[0].messages.slice(-5).map(m => ({
                                id: m.id,
                                role: m.role,
                                content: m.content,
                                timestamp: m.timestamp,
                                agentId: m.agentId
                            }))
                        }];
                        try {
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(latestOnly));
                        } catch (e) {
                            console.error('最小限の履歴の保存にも失敗:', e);
                        }
                    }
                }
            }
        }
    } else {
        console.error('チャット履歴の保存に失敗:', error);
    }
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
 * 
 * 注意: 画像・音声データ（Base64）は容量が大きいため、
 * LocalStorageには保存しない。必要な場合はIndexedDBを使用する。
 */
export function addMessageToSession(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatSession | null {
  const sessions = getAllSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) return null;
  
  // 大きなデータを除外してメッセージを作成
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { imageUrl, audioUrl, ...messageWithoutLargeData } = message;
  
  // pairs内の画像・音声データも除外
  let cleanedPairs = messageWithoutLargeData.pairs;
  if (cleanedPairs) {
    cleanedPairs = cleanedPairs.map(p => ({
      ...p,
      imageUrl: null,  // 画像データを保存しない
      audioData: null  // 音声データを保存しない
    }));
  }
  
  const newMessage: ChatMessage = {
    ...messageWithoutLargeData,
    pairs: cleanedPairs,
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
