"use client";

import { useEffect, useRef } from 'react';
import { SentenceImagePair } from '@/lib/agents/types';
import { generateSpeechAction } from '@/app/actions';

/**
 * バックグラウンドで音声を順次生成するカスタムフック
 * 
 * Progressive Loading UXを実現するためのフック。
 * 最初のペアの音声はサーバー側で生成済みのため、
 * 2番目以降のペアの音声をバックグラウンドで順次生成します。
 * 
 * ユーザーが最初のペアを見ている間に次の音声を準備することで、
 * 待ち時間を体感させないUXを実現します。
 * 
 * @param pairs 文章画像ペアの配列
 * @param onAudioUpdate 音声データ更新時のコールバック
 */
export function useBackgroundAudioGenerator(
  pairs: SentenceImagePair[],
  onAudioUpdate: (pairId: string, audioData: string | null) => void
) {
  const isProcessing = useRef(false);
  const processedIds = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    // 最初のペアの音声が生成済みかチェック
    const firstPair = pairs[0];
    if (!firstPair) {
      return;
    }
    
    // 最初のペアの音声がまだ生成されていない場合は待機
    // （サーバー側で生成されるはず）
    if (!firstPair.audioData) {
      console.log(`[DEBUG] Waiting for first pair audio from server...`);
      return;
    }
    
    // 音声が未生成のペアを抽出（最初のペアはスキップ）
    const pendingPairs = pairs.filter(
      (p, index) => index > 0 && !p.audioData && !processedIds.current.has(p.id)
    );
    
    if (!isProcessing.current && pendingPairs.length > 0) {
      console.log(`[DEBUG] Starting background audio generation for ${pendingPairs.length} pairs`);
      processAudioQueue(pendingPairs);
    }
  }, [pairs]);
  
  /**
   * 音声生成キューを処理する
   * 
   * @param pendingPairs 音声未生成のペア配列
   */
  const processAudioQueue = async (pendingPairs: SentenceImagePair[]) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    // 順次処理（音声生成は比較的軽いのでレート制限は緩め）
    for (const pair of pendingPairs) {
      // 既に処理済みならスキップ
      if (processedIds.current.has(pair.id)) continue;
      
      // 処理済みとしてマーク
      processedIds.current.add(pair.id);
      console.log(`[DEBUG] Generating audio for ${pair.id}...`);
      
      try {
        const audioData = await generateSpeechAction(pair.text);
        onAudioUpdate(pair.id, audioData);
        console.log(`[DEBUG] Audio generated for ${pair.id}: ${audioData ? 'success' : 'failed'}`);
      } catch (error) {
        console.error(`[ERROR] Audio generation failed for ${pair.id}:`, error);
        onAudioUpdate(pair.id, null);
      }
      
      // 次のリクエストまで少し待機（サーバー負荷軽減）
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    isProcessing.current = false;
    console.log(`[DEBUG] Background audio generation complete`);
  };
  
  // クリーンアップ時に処理済みIDをリセット
  useEffect(() => {
    return () => {
      processedIds.current.clear();
    };
  }, []);
}
