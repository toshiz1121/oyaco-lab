'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackControlsProps {
  isBookmarked: boolean;
  rating: number;
  parentNotes: string;
  onSave: (feedback: { isBookmarked?: boolean; rating?: number; parentNotes?: string }) => Promise<void>;
}

export function FeedbackControls({ isBookmarked, rating, parentNotes, onSave }: FeedbackControlsProps) {
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [currentRating, setCurrentRating] = useState(rating);
  const [notes, setNotes] = useState(parentNotes);
  const [saving, setSaving] = useState(false);

  const toggleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    setSaving(true);
    try {
      await onSave({ isBookmarked: next });
    } finally {
      setSaving(false);
    }
  };

  const setRating = async (value: number) => {
    setCurrentRating(value);
    setSaving(true);
    try {
      await onSave({ rating: value });
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      await onSave({ parentNotes: notes });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ブックマーク & 評価 */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleBookmark}
          className={cn(
            'gap-1.5',
            bookmarked && 'bg-amber-50 border-amber-300 text-amber-700'
          )}
        >
          <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-amber-500')} />
          {bookmarked ? 'ブックマーク済み' : 'ブックマーク'}
        </Button>

        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => setRating(v)}
              className="p-0.5 hover:scale-110 transition-transform"
              aria-label={`${v}つ星`}
            >
              <Star
                className={cn(
                  'h-5 w-5',
                  v <= currentRating
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-300'
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {/* メモ */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          📝 親のメモ
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="この会話について気づいたことをメモ..."
          className="w-full rounded-lg border border-slate-200 p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
        />
      </div>
    </div>
  );
}
