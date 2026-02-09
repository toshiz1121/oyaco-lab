'use client';

import type { ChildProfile } from '@/lib/firebase/types';
import { cn } from '@/lib/utils';

interface ChildSelectorProps {
  children: ChildProfile[];
  selectedChildId: string | null;
  onSelect: (childId: string) => void;
}

export function ChildSelector({ children, selectedChildId, onSelect }: ChildSelectorProps) {
  if (children.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {children.map((child) => (
        <button
          key={child.childId}
          onClick={() => onSelect(child.childId)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
            selectedChildId === child.childId
              ? 'bg-sky-500 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          )}
        >
          {child.name}（{child.age}歳）
        </button>
      ))}
    </div>
  );
}
