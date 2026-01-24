"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, History, ArrowLeftRight, FileText } from "lucide-react";
import { LoadingOverlay } from "./LoadingOverlay";
import { Artist } from "@/lib/artists";
import { useState, useEffect, useRef, useMemo } from "react";
import { GenerationMetadata, getGenerationHistory, getGenerationMetadata } from "@/lib/generation-history";
import { getImage } from "@/lib/image-storage";
import { PromptDetailsDialog } from "./PromptDetailsDialog";

interface GeneratorCanvasProps {
  imageUrl: string | null;
  isLoading: boolean;
  onDownload?: () => void;
  selectedArtist: Artist | null;
  currentMetadata?: GenerationMetadata | null;
  onMetadataChange?: (metadata: GenerationMetadata | null) => void;
  progress?: {
    imageGeneration: boolean;
    comment: boolean;
  };
}

// 履歴アイテムの型定義
interface HistoryItem {
  imageId: string;
  timestamp: number;
  metadataId: string; // GenerationMetadata.id
}

export function GeneratorCanvas({ imageUrl, isLoading, onDownload, selectedArtist, currentMetadata, onMetadataChange, progress }: GeneratorCanvasProps) {
  // 履歴管理（imageIdベース）
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [imageCache, setImageCache] = useState<Map<string, string>>(new Map()); // imageId → DataURL
  const [showComparison, setShowComparison] = useState(false);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [displayMetadata, setDisplayMetadata] = useState<GenerationMetadata | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingRef = useRef<Set<string>>(new Set()); // 読み込み中のimageIdを追跡
  const imageCacheRef = useRef<Map<string, string>>(new Map()); // キャッシュの参照用
  const lastAddedMetadataId = useRef<string | null>(null); // 最後に追加したmetadataIdを追跡（無限ループ防止）
  
  // imageCacheRefを同期
  useEffect(() => {
    imageCacheRef.current = imageCache;
  }, [imageCache]);

  // ページロード時の履歴復元
  useEffect(() => {
    const loadHistory = async () => {
      const allMetadata = getGenerationHistory(); // 新しい順
      console.log('[履歴復元] LocalStorageから取得:', allMetadata.length, '件');
      
      const historyItems: HistoryItem[] = allMetadata
        .filter(m => m.imageId) // imageIdがあるもののみ
        .map(m => ({
          imageId: m.imageId,
          timestamp: m.timestamp,
          metadataId: m.id,
        }));
      
      console.log('[履歴復元] フィルタ後:', historyItems.length, '件');
      console.log('[履歴復元] アイテム:', historyItems.map(h => ({ id: h.imageId.substring(0, 8), ts: h.timestamp })));
      
      setHistory(historyItems);
      
      // 最新の画像をキャッシュに読み込み
      if (historyItems.length > 0) {
        console.log('[履歴復元] 最新画像の読み込み開始:', historyItems[0].imageId.substring(0, 8));
        const latestImageUrl = await getImage(historyItems[0].imageId);
        console.log('[履歴復元] 画像読み込み結果:', latestImageUrl ? 'success' : 'failed');
        
        if (latestImageUrl) {
          setImageCache(new Map([[historyItems[0].imageId, latestImageUrl]]));
          setCurrentHistoryIndex(0);
          console.log('[履歴復元] キャッシュと履歴インデックスを設定完了');
        } else {
          console.error('[履歴復元] 画像が見つかりません:', historyItems[0].imageId);
        }
      } else {
        console.log('[履歴復元] 履歴アイテムなし');
      }
    };
    
    loadHistory();
  }, []); // 初回のみ実行

  // 親コンポーネントから新しいメタデータが渡されたときの処理
  useEffect(() => {
    if (!currentMetadata || !imageUrl || isLoading) return;
    
    // 既に履歴に存在するかチェック
    const alreadyExists = history.some(item => item.metadataId === currentMetadata.id);
    if (alreadyExists) {
      console.log('[新規追加] 既に履歴に存在:', currentMetadata.id.substring(0, 8));
      return;
    }
    
    console.log('[新規追加] 親から新しいメタデータを受信:', currentMetadata.id.substring(0, 8));
    
    const newItem: HistoryItem = {
      imageId: currentMetadata.imageId,
      timestamp: currentMetadata.timestamp,
      metadataId: currentMetadata.id,
    };
    
    // 履歴に追加
    setHistory(prev => [newItem, ...prev]);
    
    // キャッシュに追加
    setImageCache(prev => new Map(prev).set(currentMetadata.imageId, imageUrl));
    setCurrentHistoryIndex(0);
    
    console.log('[新規追加] 履歴とキャッシュを更新完了');
  }, [currentMetadata?.id, imageUrl, isLoading]); // idのみを監視

  // 履歴ナビゲーション時の画像読み込み
  useEffect(() => {
    if (history.length === 0 || currentHistoryIndex < 0) return;
    
    const currentItem = history[currentHistoryIndex];
    if (!currentItem) return;
    
    // キャッシュにあればエラーをクリア
    if (imageCacheRef.current.has(currentItem.imageId)) {
      setLoadError(null);
      return;
    }
    
    // 既に読み込み中の場合はスキップ
    if (loadingRef.current.has(currentItem.imageId)) {
      return;
    }
    
    const loadImageForCurrentIndex = async () => {
      // 読み込み開始
      loadingRef.current.add(currentItem.imageId);
      
      try {
        const imageUrl = await getImage(currentItem.imageId);
        if (imageUrl) {
          setImageCache(prev => new Map(prev).set(currentItem.imageId, imageUrl));
          setLoadError(null);
        } else {
          setLoadError("画像が見つかりません");
        }
      } catch (error) {
        console.error("Failed to load image:", error);
        setLoadError("画像の読み込みに失敗しました");
      } finally {
        // 読み込み完了
        loadingRef.current.delete(currentItem.imageId);
      }
    };
    
    loadImageForCurrentIndex();
  }, [currentHistoryIndex, history]);

  // メタデータの取得
  useEffect(() => {
    const loadMetadataForCurrentIndex = () => {
      if (history.length === 0 || currentHistoryIndex < 0) return;
      
      const currentItem = history[currentHistoryIndex];
      if (!currentItem) return;
      
      // LocalStorageから取得
      const metadata = getGenerationMetadata(currentItem.metadataId);
      setDisplayMetadata(metadata);
      
      if (onMetadataChange) {
        onMetadataChange(metadata);
      }
    };
    
    loadMetadataForCurrentIndex();
  }, [currentHistoryIndex, history]); // onMetadataChangeを依存配列から削除

  // 表示用の画像URL取得
  const currentDisplayImage = history.length > 0 && currentHistoryIndex >= 0
    ? imageCache.get(history[currentHistoryIndex].imageId) || null
    : null;

  const previousImage = currentHistoryIndex > 0
    ? imageCache.get(history[currentHistoryIndex - 1].imageId) || null
    : null;

  // 画像URLまたは履歴がある場合は表示
  const shouldShow = imageUrl || isLoading || currentDisplayImage || history.length > 0;
  
  if (!shouldShow) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">生成された傑作</h3>
          {history.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentHistoryIndex(prev => Math.max(0, prev - 1))}
                disabled={currentHistoryIndex <= 0}
                title="前のバージョン"
              >
                <History className="h-4 w-4 rotate-180 scale-x-[-1]" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentHistoryIndex + 1} / {history.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentHistoryIndex(prev => Math.min(history.length - 1, prev + 1))}
                disabled={currentHistoryIndex >= history.length - 1}
                title="次のバージョン"
              >
                <History className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {history.length > 1 && (
            <Button
              variant={showComparison ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
              title="修正前と比較"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              比較
            </Button>
          )}
          {(displayMetadata || currentMetadata) && !isLoading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPromptDetails(true)}
              title="プロンプト詳細"
            >
              <FileText className="mr-2 h-4 w-4" />
              プロンプト
            </Button>
          )}
          {currentDisplayImage && !isLoading && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="mr-2 h-4 w-4" />
              ダウンロード
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Card className="overflow-hidden aspect-square relative flex items-center justify-center bg-muted/50">
          {selectedArtist && <LoadingOverlay artist={selectedArtist} isVisible={isLoading} progress={progress} />}
          
          {/* エラー表示 */}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-30">
              <p className="text-destructive text-sm">{loadError}</p>
            </div>
          )}
          
          {currentDisplayImage && !isLoading ? (
            <div className="relative w-full h-full group">
              {showComparison && previousImage ? (
                // 比較モード: ホバーで切り替え
                <>
                  <div className="absolute inset-0 z-10 transition-opacity duration-300 opacity-0 hover:opacity-100 cursor-pointer">
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      修正前 (Previous)
                    </div>
                    <Image
                      src={previousImage}
                      alt="Previous Version"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="absolute inset-0 z-0">
                    <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-20">
                      修正後 (Current) - ホバーで比較
                    </div>
                    <Image
                      src={currentDisplayImage}
                      alt="Current Version"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </>
              ) : (
                // 通常モード
                <Image
                  src={currentDisplayImage}
                  alt="Generated Masterpiece"
                  fill
                  className="object-contain"
                  unoptimized
                />
              )}
            </div>
          ) : !isLoading && !currentDisplayImage ? null : (
             <div className="space-y-4 w-full p-8 flex flex-col items-center opacity-0">
               <Skeleton className="h-64 w-64 rounded-full" />
             </div>
          )}
       </Card>
     </div>

     {/* プロンプト詳細ダイアログ */}
     <PromptDetailsDialog
       open={showPromptDetails}
       onOpenChange={setShowPromptDetails}
       metadata={displayMetadata || null}
     />
   </div>
 );
}
