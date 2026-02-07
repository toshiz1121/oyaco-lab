"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair, PairStatus } from '@/lib/agents/types';
import { generateNextImageAction } from '@/app/actions';

/**
 * バックグラウンドで画像を並列生成するカスタムフック
 * 
 * 実装背景:
 * - 並列文章-画像生成フローのためのフック
 * - MAX_PARALLEL制限（2）を実装
 * - アクティブリクエストとキューの管理
 * - ペア状態更新のコールバック
 * 
 * @param pairs 文章画像ペアの配列
 * @param onPairUpdate ペア状態更新時のコールバック
 * @returns アクティブなリクエスト数とキューの長さ
 */
export function useBackgroundImageGenerator(
  pairs: SentenceImagePair[],
  onPairUpdate: (pairId: string, imageUrl: string | null, status: PairStatus) => void
) {
  const MAX_PARALLEL = 1; // レート制限対策: 同時に1つのみ実行
  const REQUEST_DELAY = 3000; // リクエスト間の遅延（3秒）
  const activeRequests = useRef<Set<string>>(new Set());
  const queue = useRef<SentenceImagePair[]>([]);
  const isProcessing = useRef(false);
  const lastRequestTime = useRef<number>(0);
  
  useEffect(() => {
    // 最初のペア（すでに生成済み）をスキップ
    // また、最初のペアが'generating'の場合は待機
    const firstPair = pairs[0];
    if (!firstPair || firstPair.status === 'generating') {
      console.log(`[DEBUG] Waiting for first pair to complete before starting background generation...`);
      return;
    }
    
    const pendingPairs = pairs.filter(
      (p, index) => index > 0 && p.status === 'pending'
    );
    
    queue.current = pendingPairs;
    
    if (!isProcessing.current && queue.current.length > 0) {
      console.log(`[DEBUG] Starting background generation for ${queue.current.length} pairs`);
      processQueue();
    }
  }, [pairs]);
  
  const processQueue = async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    // レート制限対策: 順次処理（MAX_PARALLEL=1）
    // 各リクエスト間に遅延を入れる
    
    while (queue.current.length > 0 || activeRequests.current.size > 0) {
      // アクティブなリクエストがMAX_PARALLEL未満で、キューにアイテムがある場合
      while (queue.current.length > 0 && activeRequests.current.size < MAX_PARALLEL) {
        const pair = queue.current.shift();
        if (!pair) break;
        
        // レート制限対策: 前回のリクエストから一定時間経過するまで待機
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime.current;
        if (timeSinceLastRequest < REQUEST_DELAY) {
          const waitTime = REQUEST_DELAY - timeSinceLastRequest;
          console.log(`[DEBUG] Waiting ${waitTime}ms before next request to avoid rate limit...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        lastRequestTime.current = Date.now();
        
        activeRequests.current.add(pair.id);
        
        // ステータスを'generating'に更新
        onPairUpdate(pair.id, null, 'generating');
        
        // 画像生成（非同期で実行）
        generateNextImageAction(pair.id, pair.visualDescription)
          .then(({ imageUrl, status }) => {
            onPairUpdate(pair.id, imageUrl, status);
          })
          .catch((error) => {
            console.error(`[ERROR] Unexpected error for ${pair.id}:`, error);
            onPairUpdate(pair.id, null, 'error');
          })
          .finally(() => {
            activeRequests.current.delete(pair.id);
            // 次のキューアイテムを処理
            if (queue.current.length > 0) {
              processQueue();
            }
          });
      }
      
      // アクティブなリクエストが完了するまで待機
      if (activeRequests.current.size >= MAX_PARALLEL || queue.current.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // すべて完了したら終了
      if (queue.current.length === 0 && activeRequests.current.size === 0) {
        break;
      }
    }
    
    isProcessing.current = false;
  };
  
  return {
    activeCount: activeRequests.current.size,
    queueLength: queue.current.length,
  };
}
