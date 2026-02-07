'use client';

export const dynamic = 'force-dynamic';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getChildProfile } from '@/lib/firebase/firestore';
import { ChildProfile } from '@/lib/firebase/types';

export default function SelectChildPage() {
    const { parentUserId, childrenIds, selectChild, loading } = useAuth();
    const router = useRouter();
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [loadingChildren, setLoadingChildren] = useState(true);

    useEffect(() => {
        if(!loading && !parentUserId) {
            router.push('/login');
        }
    }, [parentUserId, loading, router]);

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
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-xl">読み込み中...</div>
        </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-center mb-2">
                どのお子さんが使いますか？
                </h1>
                <p className="text-gray-600 text-center mb-8">
                お子さんを選択してください
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {children.map((child) => (
                    <button
                    key={child.childId}
                    onClick={() => handleSelectChild(child.childId)}
                    className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
                    >
                    <div className="text-6xl mb-4">👦</div>
                    <h2 className="text-xl font-bold mb-2">{child.name}</h2>
                    <p className="text-gray-600 mb-2">{child.age}歳</p>
                    <div className="text-sm text-gray-500">
                        <p>{child.stats.totalQuestions}個の質問</p>
                        <p>{child.stats.totalConversations}回の会話</p>
                    </div>
                    </button>
                ))}

                {/* 子供追加ボタン */}
                <button
                    onClick={handleAddChild}
                    className="bg-blue-50 border-2 border-dashed border-blue-300 p-6 rounded-lg hover:bg-blue-100 transition-colors"
                >
                    <div className="text-6xl mb-4">➕</div>
                    <h2 className="text-xl font-bold text-blue-600">
                    子供を追加
                    </h2>
                    <p className="text-sm text-gray-600 mt-2">
                    新しいお子さんのプロフィールを作成
                    </p>
                </button>
                </div>

                {children.length === 0 && (
                <div className="text-center mt-8 text-gray-600">
                    <p>まだお子さんが登録されていません</p>
                    <p className="text-sm mt-2">「子供を追加」ボタンから登録してください</p>
                </div>
                )}
            </div>
        </div>
    );

}