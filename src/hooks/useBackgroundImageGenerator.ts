"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair, PairStatus } from '@/lib/agents/types';
import { generateNextImageAction } from '@/app/actions';

/**
 * バックグラウンドで画像を順次生成するカスタムフック
 * 
 * レート制限対策:
 * - サーバー側のグローバルリクエストキューが全Vertex AIリクエストを一元管理
 * - 画像生成はnormal優先度でキューに入り、TTS（high）の後に処理される
 * - クライアント側での独自ディレイは不要
 * 
 * @param pairs 文章画像ペアの配列
 * @param onPairUpdate ペア状態更新時のコールバック
 */
export function useBackgroundImageGenerator(
  pairs: SentenceImagePair[],
  onPairUpdate: (pairId: string, imageUrl: string | null, status: PairStatus) => void
) {
  const isProcessing = useRef(false);
  const processedIds = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const firstPair = pairs[0];
    if (!firstPair || firstPair.status === 'generating') {
      console.log(`[ImageGen] Waiting for first pair to complete before starting background generation...`);
      return;
    }
    
    const pendingPairs = pairs.filter(
      (p, index) => index > 0 && p.status === 'pending' && !processedIds.current.has(p.id)
    );
    
    if (!isProcessing.current && pendingPairs.length > 0) {
      console.log(`[ImageGen] Starting background generation for ${pendingPairs.length} pairs`);
      processQueue(pendingPairs);
    }
  }, [pairs]);
  
  const processQueue = async (pendingPairs: SentenceImagePair[]) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    for (const pair of pendingPairs) {
      if (processedIds.current.has(pair.id)) continue;
      
      processedIds.current.add(pair.id);
      onPairUpdate(pair.id, null, 'generating');
      
      try {
        console.log(`[ImageGen] Generating image for ${pair.id}...`);
        const { imageUrl, status } = await generateNextImageAction(pair.id, pair.visualDescription);
        onPairUpdate(pair.id, imageUrl, status);
        console.log(`[ImageGen] Image generated for ${pair.id}: ${status}`);
      } catch (error) {
        console.error(`[ImageGen] Unexpected error for ${pair.id}:`, error);
        onPairUpdate(pair.id, null, 'error');
      }
    }
    
    isProcessing.current = false;
    console.log(`[ImageGen] Background image generation complete`);
  };
  
  // クリーンアップ時に処理済みIDをリセット
  useEffect(() => {
    return () => {
      processedIds.current.clear();
    };
  }, []);
  
  return {
    activeCount: 0,
    queueLength: 0,
  };
}
