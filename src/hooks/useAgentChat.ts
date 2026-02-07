import { useState, useEffect } from "react";
import { toast } from "sonner";
import { decideAgentAction, generateResponseAction } from "@/app/actions";
import { createSession, addMessageToSession, ChatSession } from "@/lib/chat-history";
import { AgentResponse, AgentRole } from "@/lib/agents/types";
import { useAuth } from '@/contexts/AuthContext';
import { useConversationLogger } from "./useConversationLogger";

/**
 * ビューの表示モード
 * - input: 質問入力画面
 * - selecting: エキスパート選定中（スポットライト表示）
 * - imageGenerating: 画像生成中
 * - result: 結果表示
 */
type ViewMode = 'input' | 'selecting' | 'imageGenerating' | 'result';

/**
 * useAgentChatフックのプロパティ
 */
interface UseAgentChatProps {
  /** 初期質問（セッション作成時のタイトルに使用） */
  initialQuestion?: string;
  /** 新しいセッションが作成された時のコールバック */
  onNewSession?: (session: ChatSession) => void;
}

/**
 * エージェントチャット機能を管理するカスタムフック
 * 
 * 主な機能:
 * - ユーザーの質問に対するエキスパート選定
 * - 選定されたエキスパートによる回答生成
 * - 画像生成の進捗管理
 * - チャット履歴の永続化
 * - ビューモードの状態管理
 */
export function useAgentChat({ initialQuestion, onNewSession }: UseAgentChatProps) {
  // ========================================
  // 状態管理
  // ========================================

  // 現在アクティブな子供の情報を取得する
  const { activeChildId } = useAuth();
  
  /** 現在のビュー表示モード */
  const [viewMode, setViewMode] = useState<ViewMode>('input');
  
  /** 現在処理中の質問テキスト */
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  
  /** 選定されたエキスパートの役割 */
  const [selectedExpert, setSelectedExpert] = useState<AgentRole | undefined>(undefined);
  
  /** エキスパート選定の理由 */
  const [selectionReason, setSelectionReason] = useState<string | undefined>(undefined);
  
  /** 最新のエージェント応答データ */
  const [latestResponse, setLatestResponse] = useState<AgentResponse | null>(null);
  
  /** 現在のチャットセッションID */
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  /** API呼び出しが完了したかどうか */
  const [isApiComplete, setIsApiComplete] = useState(false);
  
  /** 画像生成の進捗率（0-100） */
  const [generationProgress, setGenerationProgress] = useState(0);
  
  /** 音声生成中かどうか */
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  
  /** 音声生成の進捗率（0-100） */
  const [audioProgress, setAudioProgress] = useState(0);

  // childId を activeChildId から取得
  const { logCurrentConversation, isLogging } = useConversationLogger(
    activeChildId || 'child1' // フォールバック
  );

  // ========================================
  // セッション初期化
  // ========================================
  
  /**
   * コンポーネントマウント時にチャットセッションを作成
   * セッションIDが未設定の場合のみ実行される
   */
  useEffect(() => {
    if (!sessionId) {
      const session = createSession(initialQuestion || "新しい対話");
      setSessionId(session.id);
      if (onNewSession) onNewSession(session);
    }
  }, [initialQuestion, sessionId, onNewSession]);

  // ========================================
  // 進捗バーのアニメーション
  // ========================================
  
  /**
   * 画像生成中の進捗バーをシミュレート
   * 
   * - API完了前: 0-90%の範囲でランダムに増加
   * - API完了後: 100%に設定
   * 
   * ユーザーに処理が進行中であることを視覚的にフィードバック
   */
  useEffect(() => {
    if (viewMode === 'imageGenerating' && !isApiComplete) {
      const interval = setInterval(() => {
        setGenerationProgress((prev) => {
          if (prev < 90) {
            return prev + Math.random() * 3 + 1;
          }
          return prev;
        });
      }, 300);
      return () => clearInterval(interval);
    }
    
    if (isApiComplete && viewMode === 'imageGenerating') {
      setGenerationProgress(100);
    }
  }, [viewMode, isApiComplete]);

  // ========================================
  // 結果画面への自動遷移
  // ========================================
  
  /**
   * 画像生成と音声生成が完了したら結果画面に自動遷移
   * 
   * viewModeに関係なく、生成完了したら結果画面へ遷移
   */
  useEffect(() => {
    if (isApiComplete && latestResponse) {
      console.log('[useAgentChat] 生成完了 → 結果画面に遷移');
      // 少し遅延を入れてスムーズに遷移
      const timer = setTimeout(() => {
        setViewMode('result');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isApiComplete, latestResponse]);

  // ========================================
  // イベントハンドラー
  // ========================================
  
  /**
   * ユーザーからの質問を処理
   * 
   * 処理フロー:
   * 1. 状態の初期化とユーザーメッセージの保存
   * 2. エキスパート選定（decideAgentAction）
   * 3. スポットライトアニメーション（前回と異なるエキスパートの場合）
   * 4. 回答生成（generateResponseAction）
   * 5. アシスタントメッセージの保存
   * 6. 結果画面への遷移
   * 
   * @param question - ユーザーの質問テキスト
   */
  const handleQuestion = async (question: string) => {
    if (!sessionId) return;
    
    setCurrentQuestion(question);
    const prevExpert = selectedExpert;
    
    // 状態をリセット
    setViewMode('selecting');
    setSelectedExpert(undefined);
    setIsApiComplete(false);
    setGenerationProgress(0);
    setIsAudioGenerating(false);
    setAudioProgress(0);

    // 音声進捗インターバルの参照を保持
    let audioProgressInterval: NodeJS.Timeout | null = null;

    try {
      // ユーザーメッセージをセッションに保存
      addMessageToSession(sessionId, {
        role: 'user',
        content: question
      });

      // 会話履歴を構築（直前の応答のみを含める）
      const history = latestResponse ? [
        { role: 'assistant', content: latestResponse.text }
      ] : [];

      // ========================================
      // フェーズ1: エキスパート選定
      // ========================================
      console.log('[useAgentChat] フェーズ1: エージェント選定中...');
      const decisionResult = await decideAgentAction(question, history);

      if (!decisionResult.success || !decisionResult.agentId) {
        toast.error("博士の選定に失敗しました");
        setViewMode('input');
        return;
      }

      const newExpert = decisionResult.agentId;
      const newSelectionReason = decisionResult.selectionReason;
      
      console.log(`[useAgentChat] 選定されたエージェント: ${newExpert}`);
      
      setSelectedExpert(newExpert);
      setSelectionReason(newSelectionReason);
      
      // 前回と同じエキスパートの場合はスポットライトアニメーションをスキップ
      if (newExpert === prevExpert) {
        console.log('[useAgentChat] 同じエキスパートのためスポットライトをスキップ');
        setViewMode('imageGenerating');
      }

      // ========================================
      // フェーズ2: 回答生成
      // ========================================
      console.log('[useAgentChat] フェーズ2: 回答生成中...');
      
      // 音声生成の進捗シミュレーションを開始
      setIsAudioGenerating(true);
      audioProgressInterval = setInterval(() => {
        setAudioProgress(prev => Math.min(prev + 8, 90));
      }, 200);
      
      const responseResult = await generateResponseAction(newExpert, question, history, 'default');

      // インターバルをクリア
      if (audioProgressInterval) {
        clearInterval(audioProgressInterval);
        audioProgressInterval = null;
      }

      if (!responseResult.success || !responseResult.data) {
        toast.error("回答の生成に失敗しました");
        setViewMode('input');
        setIsAudioGenerating(false);
        setAudioProgress(0);
        return;
      }

      // 選定理由を応答データに追加
      const responseData = {
        ...responseResult.data,
        selectionReason: newSelectionReason
      };

      console.log('[useAgentChat] 回答生成完了');

      // アシスタントメッセージをセッションに保存
      addMessageToSession(sessionId, {
        role: 'assistant',
        content: responseData.text,
        agentId: responseData.agentId,
        steps: responseData.steps,
        imageUrl: responseData.imageUrl,
        pairs: responseData.pairs,
        useParallelGeneration: responseData.useParallelGeneration
      });

      setLatestResponse(responseData);
      
      // 音声生成完了
      setAudioProgress(100);
      setTimeout(() => {
        setIsAudioGenerating(false);
      }, 300);
      
      setIsApiComplete(true);

      // Firestoreに会話ログを保存
      // 子供に紐付けて会話ログを保存するため
      if(activeChildId) {
        logCurrentConversation(question, newExpert, newSelectionReason, responseData);
      }

    } catch (e) {
      console.error('[useAgentChat] エラー:', e);
      toast.error("通信エラー");
      setViewMode('input');
      setIsAudioGenerating(false);
      setAudioProgress(0);
      
      // エラー時もインターバルをクリア
      if (audioProgressInterval) {
        clearInterval(audioProgressInterval);
      }
    }
  };

  /**
   * スポットライトアニメーション完了時のハンドラー
   * 画像生成画面に遷移する
   */
  const handleSpotlightComplete = () => {
    setViewMode('imageGenerating');
  };

  // ========================================
  // 戻り値
  // ========================================
  
  return {
    // 状態
    viewMode,              // 現在のビューモード
    currentQuestion,       // 処理中の質問
    selectedExpert,        // 選定されたエキスパート
    selectionReason,       // 選定理由
    latestResponse,        // 最新の応答データ
    generationProgress,    // 生成進捗率
    isAudioGenerating,     // 音声生成中フラグ
    audioProgress,         // 音声生成進捗率
    
    // アクション
    handleQuestion,        // 質問処理ハンドラー
    handleSpotlightComplete, // スポットライト完了ハンドラー
  };
}
