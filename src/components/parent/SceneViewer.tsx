'use client';

import type { ConversationScene } from '@/lib/firebase/types';
import Image from 'next/image';

interface SceneViewerProps {
  scenes: ConversationScene[];
}

export function SceneViewer({ scenes }: SceneViewerProps) {
  return (
    <div className="space-y-4">
      {scenes.map((scene, index) => (
        <div key={scene.sceneId} className="bg-white rounded-xl border p-4">
          <div className="text-xs text-slate-400 mb-2 font-medium">
            シーン {index + 1} / {scenes.length}
          </div>

          {scene.imageUrl && !scene.imageUrl.startsWith('data:') && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-3 bg-slate-100">
              <Image
                src={scene.imageUrl}
                alt={scene.imageHint || `シーン ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
              />
            </div>
          )}

          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {scene.script}
          </p>
        </div>
      ))}
    </div>
  );
}
