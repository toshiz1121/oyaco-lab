/**
 * Firebase 接続テストページ
 * 
 * Firebaseの接続確認と基本的な動作テストを行う
 */

'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { createChildProfile, getChildProfile } from '@/lib/firebase/firestore';

export default function TestFirebasePage() {
  const [status, setStatus] = useState('接続テスト準備中...');
  const [testData, setTestData] = useState<any[]>([]);
  const [childProfile, setChildProfile] = useState<any>(null);

  useEffect(() => {
    // ページ読み込み時に接続テスト
    testConnection();
  }, []);

  /**
   * Firebase接続テスト
   */
  const testConnection = async () => {
    try {
      setStatus('🔄 接続テスト中...');

      // テストデータを書き込み
      const testRef = collection(db, 'test');
      const docRef = await addDoc(testRef, {
        message: 'Hello Firebase!',
        timestamp: new Date(),
        testNumber: Math.random(),
      });

      setStatus(`✅ 接続成功！ドキュメントID: ${docRef.id}`);

      // データを読み込み
      const snapshot = await getDocs(testRef);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTestData(data);

    } catch (error) {
      setStatus(`❌ エラー: ${error}`);
      console.error('Firebase接続エラー:', error);
    }
  };

  /**
   * 子供プロフィール作成テスト
   */
  const createTestChild = async () => {
    try {
      setStatus('🔄 子供プロフィール作成中...');

      const profile = await createChildProfile(
        'child1',
        'テスト太郎',
        5,
        'parent1'
      );

      setChildProfile(profile);
      setStatus('✅ 子供プロフィール作成成功！');

    } catch (error) {
      setStatus(`❌ エラー: ${error}`);
      console.error('プロフィール作成エラー:', error);
    }
  };

  /**
   * 子供プロフィール取得テスト
   */
  const loadTestChild = async () => {
    try {
      setStatus('🔄 子供プロフィール取得中...');

      const profile = await getChildProfile('child1');

      if (profile) {
        setChildProfile(profile);
        setStatus('✅ 子供プロフィール取得成功！');
      } else {
        setStatus('⚠️ プロフィールが見つかりません');
      }

    } catch (error) {
      setStatus(`❌ エラー: ${error}`);
      console.error('プロフィール取得エラー:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          🔥 Firebase 接続テスト
        </h1>

        {/* ステータス表示 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3 text-gray-700">
            接続ステータス
          </h2>
          <p className="text-lg">{status}</p>
        </div>

        {/* テストボタン */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">
            テスト操作
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={testConnection}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              接続テスト
            </button>
            <button
              onClick={createTestChild}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              子供プロフィール作成
            </button>
            <button
              onClick={loadTestChild}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              プロフィール取得
            </button>
          </div>
        </div>

        {/* テストデータ表示 */}
        {testData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">
              取得データ（test コレクション）
            </h2>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
              {JSON.stringify(testData, null, 2)}
            </pre>
          </div>
        )}

        {/* 子供プロフィール表示 */}
        {childProfile && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">
              子供プロフィール
            </h2>
            <div className="space-y-2">
              <p><strong>ID:</strong> {childProfile.childId}</p>
              <p><strong>名前:</strong> {childProfile.name}</p>
              <p><strong>年齢:</strong> {childProfile.age}歳</p>
              <p><strong>親ID:</strong> {childProfile.parentUserId}</p>
              <p><strong>総会話数:</strong> {childProfile.stats.totalConversations}</p>
              <p><strong>総質問数:</strong> {childProfile.stats.totalQuestions}</p>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                詳細データを表示
              </summary>
              <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm mt-2">
                {JSON.stringify(childProfile, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* 説明 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800">
            📝 使い方
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>「接続テスト」ボタンでFirebaseへの接続を確認</li>
            <li>「子供プロフィール作成」で child1 のプロフィールを作成</li>
            <li>「プロフィール取得」で保存されたデータを確認</li>
            <li>Firebase Console でデータが保存されているか確認</li>
          </ol>
        </div>

        {/* Firebase Console リンク */}
        <div className="mt-6 text-center">
          <a
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Firebase Console を開く →
          </a>
        </div>
      </div>
    </div>
  );
}
