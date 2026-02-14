/**
 * useBackgroundPairGenerator — 次のステップの音声を先読み生成するフック
 *
 * 【戦略】
 *  - 画像は初回レスポンス時に4パネル結合画像として一括生成済み
 *  - 音声だけ currentIndex+1 のステップ分を先読み生成する
 *  - ステップ遷移時にすぐ再生できるようにキャッシュしておく
 *
 * 【呼び出し元】
 *  ResultView が currentIndex（現在表示中のステップ番号）を渡す
 *  → currentIndex が変わるたびに次のステップの音声を生成
 */
"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair, PairStatus, AgentRole } from '@/lib/agents/types';
import { generateNextPairAudioAction } from '@/app/actions';

export function useBackgroundPairGenerator(
  pairs: SentenceImagePair[],
  currentIndex: number,
  agentId: AgentRole,
  onPairUpdate: (pairId: string, updates: { audioData?: string | null; imageUrl?: string | null; status?: PairStatus }) => void
) {
  // 生成済み or 生成中の pair ID を追跡（重複リクエスト防止）
  const generatingIds = useRef<Set<string>>(new Set());

  // currentIndex が変わるたびに「次のステップ」の音声を先読み
  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= pairs.length) return;

    const nextPair = pairs[nextIndex];
    if (!nextPair) return;

    // 既に音声あり or 生成中ならスキップ
    if (nextPair.audioData) return;
    if (generatingIds.current.has(nextPair.id)) return;

    generatingIds.current.add(nextPair.id);

    (async () => {
      // ステップ2以降は前のステップの再生と被らないよう 3 秒待機
      if (nextIndex > 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const audioData = await generateNextPairAudioAction(nextPair.id, nextPair.text, agentId);
      onPairUpdate(nextPair.id, { audioData });
    })().catch(() => {
      // 音声先読み失敗はユーザー体験に致命的ではないため握りつぶす
    });
  }, [currentIndex, pairs.length]);

  // アンマウント時にクリーンアップ
  useEffect(() => {
    return () => { generatingIds.current.clear(); };
  }, []);
}
