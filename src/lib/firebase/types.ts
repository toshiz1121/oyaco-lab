/**
 * Firebase Firestore データ型定義
 * 
 * 会話ログシステムで使用するFirestoreのデータ構造を定義
 * 完全なスキーマ定義は docs/doing/firestore-database-schema.md を参照
 */

import { Timestamp } from 'firebase/firestore';

// ========================================
// 親アカウント（Googleログインユーザー）
// ========================================

/**
 * 親ユーザー（Googleアカウント）
 * Collection: users/{parentUserId}
 */
export interface ParentUser {
  userId: string;              // Google UID
  email: string;               // Googleメールアドレス
  displayName: string;         // 表示名
  photoURL?: string;           // プロフィール画像
  
  // 子供管理
  children: string[];          // 子供IDの配列
  activeChildId?: string;      // 現在選択中の子供ID
  
  // メタデータ
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  updatedAt: Timestamp;
  
  // 設定
  settings: {
    language: 'ja' | 'en';
    notifications: boolean;
    theme?: 'light' | 'dark';
  };
  
  // 統計（キャッシュ）
  stats?: {
    totalChildren: number;
    totalQuestions: number;
  };
}

// ========================================
// 子供プロフィール
// ========================================

/**
 * 子供のプロフィール情報
 * Collection: children/{childId}
 */
export interface ChildProfile {
  childId: string;             // 一意識別子
  parentUserId: string;        // 親のGoogle UID
  
  // プロフィール
  name: string;                // ニックネーム
  age: number;                 // 年齢（3-12）
  grade?: string;              // 学年（オプション）
  avatar?: string;             // アバター画像URL
  birthYear?: number;          // 生まれ年（オプション）
  
  // 状態
  isActive: boolean;           // アクティブ状態
  
  // タイムスタンプ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // 統計情報（キャッシュ）
  stats: {
    totalConversations: number;
    totalQuestions: number;
    totalScenes: number;
    favoriteTopics: string[];
    favoriteExperts: string[];
    lastActivityAt: Timestamp;
    averageScenesPerConversation: number;
  };
  
  // 学習傾向（オプション）
  learningProfile?: {
    curiosityLevel: 'high' | 'medium' | 'low';
    preferredStyle: 'visual' | 'text' | 'mixed';
    attentionSpan: number;     // 平均会話時間（秒）
  };
}

// ========================================
// 会話履歴
// ========================================

/**
 * 会話のメタデータ
 * Collection: children/{childId}/conversations/{conversationId}
 */
export interface ConversationMetadata {
  conversationId: string;       // 会話ID
  childId: string;              // 子供ID
  
  // 質問情報
  question: string;             // 子供の質問
  questionTimestamp: Timestamp; // 質問日時
  
  // 分類情報
  curiosityType: string;        // 好奇心のタイプ
  selectedExpert: string;       // 選ばれた博士（AgentRole）
  selectionReason?: string;     // 選定理由
  
  // ステータス
  status: 'in_progress' | 'completed' | 'error';
  
  // メタデータ
  totalScenes: number;          // シーン数
  duration?: number;            // 会話時間（秒）
  
  // タイムスタンプ
  createdAt: Timestamp;
  completedAt?: Timestamp;
  
  // 親のフィードバック（オプション）
  parentNotes?: string;
  isBookmarked?: boolean;
  rating?: number;              // 評価（1-5）
  
  // 技術情報（デバッグ用）
  metadata?: {
    modelVersion?: string;
    generationTime?: number;
    errorMessage?: string;
  };
}

/**
 * 会話のシーン（1つの説明セグメント）
 * Collection: children/{childId}/conversations/{conversationId}/scenes/{sceneId}
 */
export interface ConversationScene {
  sceneId: string;              // シーンID（例: "scene_1"）
  order: number;                // 表示順序
  
  // テキストコンテンツ
  script: string;               // 博士のセリフ
  
  // 画像情報
  imagePromptUsed: string;      // 使用した画像プロンプト
  imageUrl: string;             // 生成された画像のURL
  imageHint: string;            // 画像のヒント
  imageGeneratedAt?: Timestamp; // 画像生成日時
  imageProvider?: string;       // 画像生成サービス
  
  // 音声情報
  audioUrl?: string;            // 音声ファイルのURL
  audioGeneratedAt?: Timestamp; // 音声生成日時
  audioDuration?: number;       // 音声の長さ（秒）
  audioProvider?: string;       // 音声生成サービス
  
  // メタデータ
  createdAt: Timestamp;
  
  // 技術情報（オプション）
  metadata?: {
    imageGenerationTime?: number;
    audioGenerationTime?: number;
    retryCount?: number;
  };
}

// ========================================
// 分析データ（オプション）
// ========================================

/**
 * 週次サマリー
 * Collection: analytics/{childId}/weekly_summary
 */
export interface WeeklySummary {
  childId: string;
  weekStart: Timestamp;
  weekEnd: Timestamp;
  
  // 統計
  totalQuestions: number;
  totalConversations: number;
  totalScenes: number;
  totalDuration: number;
  
  // トピック分析
  topTopics: Array<{
    topic: string;
    count: number;
    percentage: number;
  }>;
  
  // 博士分析
  topExperts: Array<{
    expertId: string;
    count: number;
    percentage: number;
  }>;
  
  // 活動パターン
  activityByDay: Array<{
    day: string;
    count: number;
  }>;
  
  activityByHour: Array<{
    hour: number;
    count: number;
  }>;
  
  // メタデータ
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
