'use client';

import type { ConversationScene } from '@/lib/firebase/types';
import Image from 'next/image';

interface SceneViewerProps {
  scenes: ConversationScene[];
}

export function SceneViewer({ scenes }: SceneViewerProps) {
  // 最初のシーンの画像を取得
  const firstSceneImage = scenes.find(
    (scene) => scene.imageUrl && !scene.imageUrl.startsWith('data:')
  );

  return (
    <div className="space-y-4">
      {/* 画像を一つだけ上部に表示 */}
      {firstSceneImage && (
        <div className="bg-white rounded-xl border p-4">
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-100">
            <Image
              src={firstSceneImage.imageUrl}
              alt={firstSceneImage.imageHint || '会話のイメージ'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
            />
          </div>
        </div>
      )}

      {/* シーンごとの解説を表示 */}
      {scenes.map((scene, index) => (
        <div key={scene.sceneId} className="bg-white rounded-xl border p-4">
          <div className="text-xs text-slate-400 mb-2 font-medium">
            シーン {index + 1} / {scenes.length}
          </div>

          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {scene.script}
          </p>
        </div>
      ))}
    </div>
  );
}
