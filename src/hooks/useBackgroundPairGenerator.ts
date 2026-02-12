"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair, PairStatus, AgentRole } from '@/lib/agents/types';
import { generateNextPairAudioAction } from '@/app/actions';

/**
 * 「次の1ステップだけ」の音声をバックグラウンドで先読み生成するフック
 * 
 * 戦略:
 * - 画像は初回レスポンス時に全ステップ分を並列生成済み
 * - currentIndex が変わるたびに、currentIndex+1 の音声だけを生成
 * - 音声が先にキャッシュされるので、ステップ遷移時にすぐ再生可能
 */
export function useBackgroundPairGenerator(
  pairs: SentenceImagePair[],
  currentIndex: number,
  agentId: AgentRole,
  onPairUpdate: (pairId: string, updates: { audioData?: string | null; imageUrl?: string | null; status?: PairStatus }) => void
) {
  const generatingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= pairs.length) return;

    const nextPair = pairs[nextIndex];
    if (!nextPair) return;

    // 既に音声生成済み or 生成中ならスキップ
    if (nextPair.audioData) return;
    if (generatingIds.current.has(nextPair.id)) return;

    generatingIds.current.add(nextPair.id);

    console.log(`[PairGen] Prefetching audio for ${nextPair.id} (step ${nextIndex + 1})`);

    (async () => {
      // ステップ2以降は、前のステップの音声再生との間隔を確保（3秒待機）
      if (nextIndex > 1) {
        console.log(`[PairGen] Waiting 3s before generating audio for ${nextPair.id} (step ${nextIndex + 1})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 音声を生成して即座にコールバック
      const audioData = await generateNextPairAudioAction(nextPair.id, nextPair.text, agentId);
      onPairUpdate(nextPair.id, { audioData });
      console.log(`[PairGen] Audio ready for ${nextPair.id}`);
    })().catch((error) => {
      console.error(`[PairGen] Audio prefetch failed for ${nextPair.id}:`, error);
    });
  }, [currentIndex, pairs.length]);

  useEffect(() => {
    return () => {
      generatingIds.current.clear();
    };
  }, []);
}
