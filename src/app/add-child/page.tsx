'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AddChildPage() {
  const { addChild } = useAuth();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 年齢の選択肢（3-12歳）
  const ages = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // バリデーション
    if (!name.trim()) {
      setError('お名前を入力してください');
      return;
    }

    if (!age) {
      setError('年齢を選択してください');
      return;
    }

    try {
      setSubmitting(true);
      
      // 子供を追加
      const childId = await addChild(name.trim(), age);
      
      // 成功判定: childIdが返ってきたら成功
      if (childId) {
        // 成功したら子供選択画面に戻る
        router.push('/select-child');
      } else {
        throw new Error('子供IDが取得できませんでした');
      }
      
    } catch (err) {
      console.error('[AddChild] 子供の追加に失敗:', err);
      setError('子供の追加に失敗しました。もう一度お試しください。');
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-blue-50 to-white px-4 py-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* 戻るボタン */}
        <button
          onClick={handleBack}
          className="mb-4 sm:mb-6 text-blue-600 hover:text-blue-700 flex items-center gap-2 min-h-[44px] text-sm sm:text-base"
        >
          <span>←</span>
          <span>戻る</span>
        </button>

        {/* タイトル */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">👶</div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">
            新しいお子さんを追加
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            お子さんの情報を入力してください
          </p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl sm:rounded-lg shadow-lg p-5 sm:p-8">
          {/* エラーメッセージ */}
          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-sm sm:text-base text-red-600">
              {error}
            </div>
          )}

          {/* 名前入力 */}
          <div className="mb-5 sm:mb-6">
            <Label htmlFor="name" className="text-base sm:text-lg font-semibold mb-2 block">
              お名前（ニックネーム）
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="たろう"
              className="text-base sm:text-lg p-4 sm:p-6 h-12 sm:h-14"
              maxLength={20}
              disabled={submitting}
            />
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 sm:mt-2">
              ひらがな、カタカナ、漢字で入力できます（最大20文字）
            </p>
          </div>

          {/* 年齢選択 */}
          <div className="mb-6 sm:mb-8">
            <Label className="text-base sm:text-lg font-semibold mb-2 sm:mb-3 block">
              年齢
            </Label>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {ages.map((ageOption) => (
                <button
                  key={ageOption}
                  type="button"
                  onClick={() => setAge(ageOption)}
                  disabled={submitting}
                  className={`
                    p-2.5 sm:p-4 rounded-lg border-2 font-bold text-base sm:text-lg
                    transition-all hover:scale-105 active:scale-95 min-h-[44px]
                    ${age === ageOption
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                    }
                    ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {ageOption}歳
                </button>
              ))}
            </div>
          </div>

          {/* 送信ボタン */}
          <Button
            type="submit"
            disabled={submitting || !name.trim() || !age}
            className="w-full py-5 sm:py-6 text-base sm:text-lg font-bold min-h-[48px]"
          >
            {submitting ? '追加中...' : '追加する'}
          </Button>
        </form>

        {/* 注意事項 */}
        <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-500">
          <p>※ 後から名前や年齢を変更することもできます</p>
        </div>
      </div>
    </div>
  );
}
