'use client';

import { useAuth } from '@/contexts/AuthContext';

export function ChildSelectBox() {
  const { childProfiles, activeChildId, selectChild } = useAuth();

  // 子供が1人以下なら非表示
  if (childProfiles.length <= 1) return null;

  return (
    <select
      value={activeChildId ?? ''}
      onChange={(e) => selectChild(e.target.value)}
      className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
      aria-label="子供を選択"
    >
      {childProfiles.map((child) => (
        <option key={child.childId} value={child.childId}>
          {child.name}（{child.age}歳）
        </option>
      ))}
    </select>
  );
}
