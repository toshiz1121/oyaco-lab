"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair, PairStatus } from '@/lib/agents/types';
import { generateNextPairAction } from '@/app/actions';

/**
 * 「次の1ステップだけ」をバックグラウンドで先読み生成するフック
 * 
 * 戦略:
 * - currentIndex が変わるたびに、currentIndex+1 のペアを生成
 * - 1ステップ分の音声→画像を順次生成（レート制限回避）
 * - 一気に全ステップを生成しない
 * 
 * @param pairs 全ペアの配列
 * @param currentIndex 現在表示中のステップインデックス
 * @param onPairUpdate ペア更新コールバック
 */
export function useBackgroundPairGenerator(
  pairs: SentenceImagePair[],
  currentIndex: number,
  onPairUpdate: (pairId: string, updates: { audioData?: string | null; imageUrl?: string | null; status?: PairStatus }) => void
) {
  const generatingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 先読み対象: currentIndex + 1
    const nextIndex = currentIndex + 1;
    if (nextIndex >= pairs.length) return;

    const nextPair = pairs[nextIndex];
    if (!nextPair) return;

    // 既に生成済み or 生成中ならスキップ
    if (nextPair.audioData && nextPair.status === 'ready') return;
    if (generatingIds.current.has(nextPair.id)) return;

    generatingIds.current.add(nextPair.id);
    onPairUpdate(nextPair.id, { status: 'generating' });

    console.log(`[PairGen] Prefetching pair ${nextPair.id} (step ${nextIndex + 1})`);

    generateNextPairAction(nextPair.id, nextPair.text, nextPair.visualDescription)
      .then(({ audioData, imageUrl, status }) => {
        onPairUpdate(nextPair.id, {
          audioData,
          imageUrl,
          status,
        });
        console.log(`[PairGen] Prefetch complete for ${nextPair.id}`);
      })
      .catch((error) => {
        console.error(`[PairGen] Prefetch failed for ${nextPair.id}:`, error);
        onPairUpdate(nextPair.id, { status: 'error' });
      });
  }, [currentIndex, pairs.length]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      generatingIds.current.clear();
    };
  }, []);
}
