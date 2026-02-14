/**
 * useAgentChat — チャットフロー全体を管理するフック
 *
 * 【処理の流れ】
 *  1. ユーザーが質問を入力
 *  2. Orchestrator が最適な博士を選定（Server Action: decideAgentAction）
 *  3. スポットライト演出（前回と違う博士の場合のみ）
 *  4. 選定された博士が回答を生成（Server Action: generateResponseAction）
 *     - 回答テキスト / 画像 / 音声 / 深掘り質問を並列生成
 *  5. 結果画面（ResultView）に遷移
 *  6. Firestore に会話ログを保存
 *
 * 【ビューモード】
 *  input → selecting → imageGenerating → result
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { decideAgentAction, generateResponseAction } from "@/app/actions";
import { createSession, addMessageToSession, ChatSession } from "@/lib/chat-history";
import { AgentResponse, AgentRole } from "@/lib/agents/types";
import { useAuth } from '@/contexts/AuthContext';
import { useConversationLogger } from "./useConversationLogger";

/** ビューの表示モード */
type ViewMode = 'input' | 'selecting' | 'imageGenerating' | 'result';

interface UseAgentChatProps {
  /** 初期質問（セッション作成時のタイトルに使用） */
  initialQuestion?: string;
  /** 新しいセッションが作成された時のコールバック */
  onNewSession?: (session: ChatSession) => void;
}

export function useAgentChat({ initialQuestion, onNewSession }: UseAgentChatProps) {
  // --- 認証情報 ---
  const { activeChildId } = useAuth();

  // --- 画面状態 ---
  const [viewMode, setViewMode] = useState<ViewMode>('input');
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [selectedExpert, setSelectedExpert] = useState<AgentRole | undefined>(undefined);
  const [selectionReason, setSelectionReason] = useState<string | undefined>(undefined);
  const [latestResponse, setLatestResponse] = useState<AgentResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // --- 生成進捗 ---
  const [isApiComplete, setIsApiComplete] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  // --- 会話ログ ---
  const {
    startCuriosityTypeEstimation,
    logCurrentConversation,
    isLogging
  } = useConversationLogger(activeChildId || 'child1');

  // --------------------------------------------------
  // セッション初期化（マウント時に1回だけ）
  // --------------------------------------------------
  useEffect(() => {
    if (!sessionId) {
      const session = createSession(initialQuestion || "新しい対話");
      setSessionId(session.id);
      if (onNewSession) onNewSession(session);
    }
  }, [initialQuestion, sessionId, onNewSession]);

  // --------------------------------------------------
  // 画像生成中の進捗バーアニメーション
  // API 完了前は 0→90% をゆっくり進め、完了後に 100% へ
  // --------------------------------------------------
  useEffect(() => {
    if (viewMode === 'imageGenerating' && !isApiComplete) {
      const interval = setInterval(() => {
        setGenerationProgress((prev) => (prev < 90 ? prev + Math.random() * 3 + 1 : prev));
      }, 300);
      return () => clearInterval(interval);
    }
    if (isApiComplete && viewMode === 'imageGenerating') {
      setGenerationProgress(100);
    }
  }, [viewMode, isApiComplete]);

  // --------------------------------------------------
  // 生成完了 → 結果画面へ自動遷移（500ms ディレイ）
  // --------------------------------------------------
  useEffect(() => {
    if (isApiComplete && latestResponse) {
      const timer = setTimeout(() => setViewMode('result'), 500);
      return () => clearTimeout(timer);
    }
  }, [isApiComplete, latestResponse]);

  // --------------------------------------------------
  // メイン処理: ユーザーの質問を受け取って回答を生成
  // --------------------------------------------------
  const handleQuestion = async (question: string) => {
    if (!sessionId) return;

    setCurrentQuestion(question);
    const prevExpert = selectedExpert;

    // 状態リセット
    setViewMode('selecting');
    setSelectedExpert(undefined);
    setIsApiComplete(false);
    setGenerationProgress(0);
    setIsAudioGenerating(false);
    setAudioProgress(0);

    let audioProgressInterval: NodeJS.Timeout | null = null;

    try {
      // ユーザーメッセージをローカルセッションに保存
      addMessageToSession(sessionId, { role: 'user', content: question });

      // 好奇心タイプ判定をバックグラウンドで先行開始
      if (activeChildId) {
        startCuriosityTypeEstimation(question);
      }

      // 直前の会話コンテキストを構築
      const history: { role: string; content: string }[] = [];
      if (latestResponse) {
        if (currentQuestion && currentQuestion !== question) {
          history.push({ role: 'user', content: currentQuestion });
        }
        history.push({ role: 'assistant', content: latestResponse.text });
      }

      // --- フェーズ1: 博士選定 ---
      const decisionResult = await decideAgentAction(question, history);
      if (!decisionResult.success || !decisionResult.agentId) {
        toast.error("博士の選定に失敗しました");
        setViewMode('input');
        return;
      }

      const newExpert = decisionResult.agentId;
      const newSelectionReason = decisionResult.selectionReason;
      setSelectedExpert(newExpert);
      setSelectionReason(newSelectionReason);

      // 同じ博士ならスポットライト演出をスキップ
      if (newExpert === prevExpert) {
        setViewMode('imageGenerating');
      }

      // --- フェーズ2: 回答生成 ---
      // 音声進捗のシミュレーション開始
      setIsAudioGenerating(true);
      audioProgressInterval = setInterval(() => {
        setAudioProgress(prev => Math.min(prev + 8, 90));
      }, 200);

      const responseResult = await generateResponseAction(newExpert, question, history, 'default');

      // 進捗インターバルをクリア
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

      const responseData = { ...responseResult.data, selectionReason: newSelectionReason };

      // ローカルセッションに保存
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
      setAudioProgress(100);
      setTimeout(() => setIsAudioGenerating(false), 300);
      setIsApiComplete(true);

      // --- Firestore に会話ログを保存 ---
      if (activeChildId) {
        try {
          await logCurrentConversation(question, newExpert, newSelectionReason, responseData);
        } catch {
          // ログ保存失敗はユーザー体験に影響しないため握りつぶす
        }
      }
    } catch (e) {
      console.error('[useAgentChat] エラー:', e);
      toast.error("通信エラー");
      setViewMode('input');
      setIsAudioGenerating(false);
      setAudioProgress(0);
      if (audioProgressInterval) clearInterval(audioProgressInterval);
    }
  };

  /** スポットライト演出が終わったら画像生成画面へ遷移 */
  const handleSpotlightComplete = () => {
    setViewMode('imageGenerating');
  };

  return {
    // 状態
    viewMode,
    currentQuestion,
    selectedExpert,
    selectionReason,
    latestResponse,
    generationProgress,
    isAudioGenerating,
    audioProgress,
    // アクション
    handleQuestion,
    handleSpotlightComplete,
  };
}
