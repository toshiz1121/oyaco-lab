'use client';

export const dynamic = 'force-dynamic';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getChildProfile } from '@/lib/firebase/firestore';
import { ChildProfile } from '@/lib/firebase/types';

export default function SelectChildPage() {
    const { user, parentUserId, childrenIds, selectChild, loading } = useAuth();
    const router = useRouter();
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [loadingChildren, setLoadingChildren] = useState(true);

    useEffect(() => {
        if(!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if(childrenIds.length > 0) {
            loadChildren();
        } else {
            setLoadingChildren(false);
        }
    }, [childrenIds]);

    const loadChildren = async () => {
        try {
            const profiles = await Promise.all(
                childrenIds.map(id => getChildProfile(id))
            );
            setChildren(profiles.filter(p => p !== null) as ChildProfile[]);
        } catch (error) {
            console.error('[SelectChild] 子供の読み込みに失敗:', error);
        } finally {
            setLoadingChildren(false);
        }
    }

    const handleSelectChild = async (childId: string) => {
        try {
            await selectChild(childId);
            router.push('/');
        } catch(error) {
            alert('子供の選択に失敗しました。');
        }
    }

    const handleAddChild = () => {
        router.push('/add-child');
    };

    if (loading || loadingChildren) {
        return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
            <div className="text-lg sm:text-xl animate-pulse">読み込み中...</div>
        </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-gradient-to-b from-blue-50 to-white px-4 py-6 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-center mb-1 sm:mb-2">
                どのお子さんが使いますか？
                </h1>
                <p className="text-sm sm:text-base text-gray-600 text-center mb-6 sm:mb-8">
                お子さんを選択してください
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
                {children.map((child) => (
                    <button
                    key={child.childId}
                    onClick={() => handleSelectChild(child.childId)}
                    className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 min-h-[140px] sm:min-h-[180px] flex flex-col items-center justify-center"
                    >
                    <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">👦</div>
                    <h2 className="text-base sm:text-xl font-bold mb-1 sm:mb-2">{child.name}</h2>
                    <p className="text-sm sm:text-base text-gray-600 mb-1 sm:mb-2">{child.age}歳</p>
                    <div className="text-[10px] sm:text-sm text-gray-500">
                        <p>{child.stats.totalQuestions}個の質問</p>
                        <p>{child.stats.totalConversations}回の会話</p>
                    </div>
                    </button>
                ))}

                {/* 子供追加ボタン */}
                <button
                    onClick={handleAddChild}
                    className="bg-blue-50 border-2 border-dashed border-blue-300 p-4 sm:p-6 rounded-xl sm:rounded-lg hover:bg-blue-100 transition-colors active:scale-95 min-h-[140px] sm:min-h-[180px] flex flex-col items-center justify-center"
                >
                    <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">➕</div>
                    <h2 className="text-base sm:text-xl font-bold text-blue-600">
                    子供を追加
                    </h2>
                    <p className="text-[10px] sm:text-sm text-gray-600 mt-1 sm:mt-2">
                    新しいお子さんのプロフィールを作成
                    </p>
                </button>
                </div>

                {children.length === 0 && (
                <div className="text-center mt-6 sm:mt-8 text-gray-600">
                    <p className="text-sm sm:text-base">まだお子さんが登録されていません</p>
                    <p className="text-xs sm:text-sm mt-2">「子供を追加」ボタンから登録してください</p>
                </div>
                )}
            </div>
        </div>
    );

}
