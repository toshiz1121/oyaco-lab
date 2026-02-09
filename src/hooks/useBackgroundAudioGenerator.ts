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
 * レート制限対策:
 * - サーバー側のグローバルリクエストキューが全Vertex AIリクエストを一元管理
 * - TTS は高優先度（high）でキューに入るため、画像生成より先に処理される
 * - クライアント側での独自ディレイは不要
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
    const firstPair = pairs[0];
    if (!firstPair) return;
    
    // 最初のペアの音声がまだ生成されていない場合は待機
    if (!firstPair.audioData) {
      console.log(`[AudioGen] Waiting for first pair audio from server...`);
      return;
    }
    
    // 音声が未生成のペアを抽出（最初のペアはスキップ）
    const pendingPairs = pairs.filter(
      (p, index) => index > 0 && !p.audioData && !processedIds.current.has(p.id)
    );
    
    if (!isProcessing.current && pendingPairs.length > 0) {
      console.log(`[AudioGen] Starting background audio generation for ${pendingPairs.length} pairs`);
      processAudioQueue(pendingPairs);
    }
  }, [pairs]);
  
  /**
   * 音声生成キューを処理する
   * サーバー側のグローバルキューがレート制限を管理するため、
   * ここでは単純に順次リクエストを投げるだけ
   */
  const processAudioQueue = async (pendingPairs: SentenceImagePair[]) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    
    for (const pair of pendingPairs) {
      if (processedIds.current.has(pair.id)) continue;
      
      processedIds.current.add(pair.id);
      console.log(`[AudioGen] Generating audio for ${pair.id}...`);
      
      try {
        const audioData = await generateSpeechAction(pair.text);
        onAudioUpdate(pair.id, audioData);
        console.log(`[AudioGen] Audio generated for ${pair.id}: ${audioData ? 'success' : 'failed'}`);
      } catch (error) {
        console.error(`[AudioGen] Audio generation failed for ${pair.id}:`, error);
        onAudioUpdate(pair.id, null);
      }
    }
    
    isProcessing.current = false;
    console.log(`[AudioGen] Background audio generation complete`);
  };
  
  // クリーンアップ時に処理済みIDをリセット
  useEffect(() => {
    return () => {
      processedIds.current.clear();
    };
  }, []);
}
