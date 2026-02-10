"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair, PairStatus } from '@/lib/agents/types';
import { generateNextPairAudioAction, generateNextPairImageAction } from '@/app/actions';

/**
 * 「次の1ステップだけ」をバックグラウンドで先読み生成するフック
 * 
 * 戦略:
 * - currentIndex が変わるたびに、currentIndex+1 のペアを生成
 * - 音声を先に生成→即座にコールバック→5秒待ち→画像を生成
 * - 音声が先にキャッシュされるので、ステップ遷移時にすぐ再生可能
 */
export function useBackgroundPairGenerator(
  pairs: SentenceImagePair[],
  currentIndex: number,
  onPairUpdate: (pairId: string, updates: { audioData?: string | null; imageUrl?: string | null; status?: PairStatus }) => void
) {
  const generatingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= pairs.length) return;

    const nextPair = pairs[nextIndex];
    if (!nextPair) return;

    // 既に生成済み or 生成中ならスキップ
    if (nextPair.audioData && (nextPair.status === 'ready' || nextPair.imageUrl)) return;
    if (generatingIds.current.has(nextPair.id)) return;

    generatingIds.current.add(nextPair.id);
    onPairUpdate(nextPair.id, { status: 'generating' });

    console.log(`[PairGen] Prefetching pair ${nextPair.id} (step ${nextIndex + 1})`);

    // 2段階生成: 音声→(5秒クールダウン)→画像
    (async () => {
      // ステップ2以降は、前のステップの音声再生との間隔を確保（3秒待機）
      if (nextIndex > 1) {
        console.log(`[PairGen] Waiting 3s before generating audio for ${nextPair.id} (step ${nextIndex + 1})`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 1. 音声を生成して即座にコールバック
      const audioData = await generateNextPairAudioAction(nextPair.id, nextPair.text);
      onPairUpdate(nextPair.id, { audioData });
      console.log(`[PairGen] Audio ready for ${nextPair.id}`);

      // 2. レート制限回避のクールダウン
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. 画像を生成（失敗しても音声があれば generating のまま）
      const { imageUrl, status } = await generateNextPairImageAction(nextPair.id, nextPair.visualDescription);
      // 画像成功 → ready、画像失敗でも音声があれば generating（画像なしで再生可能）
      const finalStatus = status === 'ready' ? 'ready' : (audioData ? 'generating' : 'error');
      onPairUpdate(nextPair.id, { imageUrl, status: finalStatus });
      console.log(`[PairGen] Image ${status} for ${nextPair.id}, finalStatus: ${finalStatus}`);
    })().catch((error) => {
      console.error(`[PairGen] Prefetch failed for ${nextPair.id}:`, error);
      onPairUpdate(nextPair.id, { status: 'error' });
    });
  }, [currentIndex, pairs.length]);

  useEffect(() => {
    return () => {
      generatingIds.current.clear();
    };
  }, []);
}
