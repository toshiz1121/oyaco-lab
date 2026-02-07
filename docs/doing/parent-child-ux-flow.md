# 親子UXフロー設計

## 🎯 課題

**質問**: 
- 親はどこから親専用画面（ダッシュボード）に行くの？
- 子供が親の画面にアクセスできないようにするには？

**回答**: 2つのアプローチを提案します

---

## 📱 推奨アプローチ: ヘッダーメニュー方式

### 画面構成

```
┌─────────────────────────────────────┐
│ 🔬 キッズサイエンスラボ  👦たろう ▼ │ ← ヘッダー
├─────────────────────────────────────┤
│                                     │
│  [子供モード] メイン画面            │ ← デフォルト
│  - 質問入力                         │
│  - 回答表示                         │
│                                     │
└─────────────────────────────────────┘

👦たろう ▼ をクリック
    ↓
┌─────────────────┐
│ 👦 たろう (5歳) │ ← 現在選択中
│ 👧 はなこ (7歳) │
├─────────────────┤
│ ➕ 子供を追加   │
│ 👨 親モード     │ ← 親専用画面へ
│ 🚪 ログアウト   │
└─────────────────┘
```

### 特徴

1. **子供モード（デフォルト）**
   - 質問と回答のシンプルな画面
   - 親の機能は隠されている
   - 子供が使いやすいUI

2. **親モード（ヘッダーから切り替え）**
   - 全ての子供の履歴を閲覧
   - 統計情報の確認
   - 子供の追加・編集
   - 設定変更

3. **切り替え方法**
   - ヘッダーの子供名をクリック
   - ドロップダウンメニューから「親モード」を選択
   - 簡単なPIN認証（オプション）

---

## 🔐 セキュリティ対策

### レベル1: UI非表示（基本）

子供モードでは親機能を表示しない

```typescript
// ヘッダーコンポーネント
{!isParentMode && (
  <div>子供向けシンプルUI</div>
)}

{isParentMode && (
  <div>親向け詳細UI</div>
)}
```

### レベル2: PIN認証（推奨）

親モードに入る際に4桁のPINを要求

```typescript
// 親モードに切り替え時
const enterParentMode = async () => {
  const pin = prompt('親モードに入るにはPINを入力してください');
  
  if (pin === parentUser.settings.parentPin) {
    setIsParentMode(true);
    router.push('/parent-dashboard');
  } else {
    alert('PINが違います');
  }
};
```

### レベル3: 再認証（最高セキュリティ）

親モードに入る際にGoogleで再認証

```typescript
const enterParentMode = async () => {
  // Google再認証
  await reauthenticateWithPopup(auth.currentUser, provider);
  setIsParentMode(true);
  router.push('/parent-dashboard');
};
```

---

## 🎨 画面設計詳細

### 1. 子供モード（メイン画面）

**パス**: `/`

**特徴**:
- シンプルで大きなボタン
- カラフルで楽しいデザイン
- 質問入力と回答表示のみ
- 親機能は完全に隠す

**ヘッダー**:
```
┌─────────────────────────────────────┐
│ 🔬 キッズサイエンスラボ  👦たろう ▼ │
└─────────────────────────────────────┘
```

**コンポーネント**:
```typescript
// src/components/ChildModeHeader.tsx
export function ChildModeHeader() {
  return (
    <header className="bg-gradient-to-r from-blue-400 to-purple-400 text-white">
      <div className="flex justify-between items-center p-4">
        <h1 className="text-2xl font-bold">🔬 キッズサイエンスラボ</h1>
        <ChildSelector /> {/* 子供切り替えのみ */}
      </div>
    </header>
  );
}
```

---

### 2. 親モード（ダッシュボード）

**パス**: `/parent-dashboard`

**特徴**:
- 詳細な統計情報
- 全ての子供の履歴
- 子供の管理機能
- 設定変更

**ヘッダー**:
```
┌─────────────────────────────────────┐
│ 👨 親モード | 子供モードに戻る      │
└─────────────────────────────────────┘
```

**コンポーネント**:
```typescript
// src/components/ParentModeHeader.tsx
export function ParentModeHeader() {
  return (
    <header className="bg-gray-800 text-white">
      <div className="flex justify-between items-center p-4">
        <div className="flex items-center gap-4">
          <span className="text-xl">👨 親モード</span>
          <button onClick={exitParentMode}>
            子供モードに戻る
          </button>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
```

---

## 🔄 画面遷移フロー

### 初回ログイン
```
1. ログイン画面 (/login)
   ↓ Googleログイン
2. 子供選択画面 (/select-child)
   ↓ 子供を選択
3. 子供モード (/)
```

### 親モードへの切り替え
```
子供モード (/)
   ↓ ヘッダーメニュー → 「親モード」
   ↓ PIN入力（オプション）
親モード (/parent-dashboard)
```

### 子供の切り替え
```
子供モード (/)
   ↓ ヘッダーメニュー → 別の子供を選択
子供モード (/) ※別の子供
```

### 子供の追加
```
子供モード (/)
   ↓ ヘッダーメニュー → 「子供を追加」
子供追加画面 (/add-child)
   ↓ 追加完了
子供選択画面 (/select-child)
```

---

## 💻 実装例

### 1. モード管理Context

```typescript
// src/contexts/ModeContext.tsx
'use client';

import { createContext, useContext, useState } from 'react';

interface ModeContextType {
  isParentMode: boolean;
  enterParentMode: (pin?: string) => Promise<boolean>;
  exitParentMode: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [isParentMode, setIsParentMode] = useState(false);

  const enterParentMode = async (pin?: string) => {
    // PIN認証（オプション）
    if (pin) {
      // TODO: PINを検証
      const isValid = await validatePin(pin);
      if (!isValid) {
        return false;
      }
    }
    
    setIsParentMode(true);
    return true;
  };

  const exitParentMode = () => {
    setIsParentMode(false);
  };

  return (
    <ModeContext.Provider value={{ isParentMode, enterParentMode, exitParentMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within ModeProvider');
  }
  return context;
}
```

### 2. ヘッダーコンポーネント

```typescript
// src/components/Header.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getChildProfile } from '@/lib/firebase/firestore';

export function Header() {
  const { activeChildId, childrenIds, selectChild, signOut } = useAuth();
  const { isParentMode, enterParentMode, exitParentMode } = useMode();
  const router = useRouter();
  
  const [childName, setChildName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    if (activeChildId) {
      loadChildName();
    }
    if (childrenIds.length > 0) {
      loadChildren();
    }
  }, [activeChildId, childrenIds]);

  const loadChildName = async () => {
    if (!activeChildId) return;
    const profile = await getChildProfile(activeChildId);
    if (profile) {
      setChildName(profile.name);
    }
  };

  const loadChildren = async () => {
    const profiles = await Promise.all(
      childrenIds.map(id => getChildProfile(id))
    );
    setChildren(profiles.filter(p => p !== null));
  };

  const handleSelectChild = async (childId: string) => {
    await selectChild(childId);
    setShowMenu(false);
    router.push('/');
  };

  const handleEnterParentMode = async () => {
    const pin = prompt('親モードに入るにはPINを入力してください\n（デモ用: 1234）');
    
    if (pin === '1234') { // TODO: 実際のPINと照合
      const success = await enterParentMode(pin);
      if (success) {
        setShowMenu(false);
        router.push('/parent-dashboard');
      }
    } else {
      alert('PINが違います');
    }
  };

  const handleExitParentMode = () => {
    exitParentMode();
    router.push('/');
  };

  const handleAddChild = () => {
    setShowMenu(false);
    router.push('/add-child');
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  // 親モードのヘッダー
  if (isParentMode) {
    return (
      <header className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold">👨 親モード</span>
            <button
              onClick={handleExitParentMode}
              className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
            >
              子供モードに戻る
            </button>
          </div>
          
          <button
            onClick={handleSignOut}
            className="text-gray-300 hover:text-white"
          >
            ログアウト
          </button>
        </div>
      </header>
    );
  }

  // 子供モードのヘッダー
  return (
    <header className="bg-gradient-to-r from-blue-400 to-purple-400 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">🔬 キッズサイエンスラボ</h1>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <span className="text-lg">👦 {childName}</span>
            <span className="text-sm">▼</span>
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 bg-white text-gray-800 shadow-xl rounded-lg overflow-hidden min-w-[200px] z-50">
              {/* 子供リスト */}
              <div className="border-b border-gray-200">
                {children.map((child) => (
                  <button
                    key={child.childId}
                    onClick={() => handleSelectChild(child.childId)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                      child.childId === activeChildId ? 'bg-blue-100 font-bold' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>👦</span>
                      <div>
                        <div>{child.name}</div>
                        <div className="text-xs text-gray-500">{child.age}歳</div>
                      </div>
                      {child.childId === activeChildId && (
                        <span className="ml-auto text-blue-500">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* 子供追加 */}
              <button
                onClick={handleAddChild}
                className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                <span>子供を追加</span>
              </button>
              
              {/* 親モード */}
              <button
                onClick={handleEnterParentMode}
                className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors flex items-center gap-2 border-t border-gray-200"
              >
                <span>👨</span>
                <span className="font-medium">親モード</span>
              </button>
              
              {/* ログアウト */}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 border-t border-gray-200"
              >
                <span>🚪</span>
                <span>ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

### 3. 親ダッシュボード

```typescript
// src/app/parent-dashboard/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getChildProfile, getRecentConversations } from '@/lib/firebase/firestore';

export default function ParentDashboardPage() {
  const { parentUserId, childrenIds } = useAuth();
  const { isParentMode } = useMode();
  const router = useRouter();
  
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 親モードでない場合はリダイレクト
    if (!isParentMode) {
      router.push('/');
      return;
    }
    
    loadData();
  }, [isParentMode, childrenIds]);

  const loadData = async () => {
    try {
      const profiles = await Promise.all(
        childrenIds.map(async (id) => {
          const profile = await getChildProfile(id);
          const conversations = await getRecentConversations(id, 5);
          return { profile, conversations };
        })
      );
      setChildren(profiles.filter(p => p.profile !== null));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">親ダッシュボード</h1>

        {/* 子供ごとの統計 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map(({ profile, conversations }) => (
            <div key={profile.childId} className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">👦</div>
                <div>
                  <h2 className="text-xl font-bold">{profile.name}</h2>
                  <p className="text-gray-600">{profile.age}歳</p>
                </div>
              </div>

              {/* 統計情報 */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">総質問数</span>
                  <span className="font-bold">{profile.stats.totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">総会話数</span>
                  <span className="font-bold">{profile.stats.totalConversations}</span>
                </div>
              </div>

              {/* 最近の会話 */}
              <div>
                <h3 className="font-semibold mb-2">最近の質問</h3>
                <div className="space-y-1">
                  {conversations.slice(0, 3).map((conv) => (
                    <div key={conv.conversationId} className="text-sm text-gray-600 truncate">
                      • {conv.question}
                    </div>
                  ))}
                </div>
              </div>

              {/* 詳細ボタン */}
              <button
                onClick={() => router.push(`/parent-dashboard/${profile.childId}`)}
                className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                詳細を見る
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 🎯 推奨設定

### セキュリティレベル別

| レベル | 方法 | 適用シーン |
|--------|------|-----------|
| **低** | UI非表示のみ | 家庭内のみ使用 |
| **中** | PIN認証 | 推奨（バランス良い） |
| **高** | Google再認証 | 学校など公共の場 |

### 推奨: PIN認証

**理由**:
- ✅ 子供が簡単に親モードに入れない
- ✅ 親は素早くアクセスできる
- ✅ 実装が簡単
- ✅ UXが良い

**PINの保存場所**:
```typescript
// users/{parentUserId}
{
  settings: {
    parentPin: "1234", // 暗号化推奨
    requirePinForParentMode: true
  }
}
```

---

## 📱 モバイル対応

### タブレット使用を想定

```
子供が使う: タブレットを横向き
親が確認: タブレットを縦向き + PIN入力
```

---

## 🎨 デザインの差別化

### 子供モード
- 🌈 カラフル
- 🔤 大きな文字
- 😊 楽しいアイコン
- 🎮 シンプルな操作

### 親モード
- 📊 落ち着いた色
- 📈 詳細な情報
- 📋 表形式のデータ
- ⚙️ 設定項目

---

## まとめ

### 画面構成
```
子供モード (/) ← デフォルト
  ├─ ヘッダーメニュー
  │   ├─ 子供切り替え
  │   ├─ 子供追加
  │   ├─ 親モード（PIN認証）
  │   └─ ログアウト
  │
親モード (/parent-dashboard)
  ├─ 全子供の統計
  ├─ 会話履歴
  ├─ 設定
  └─ 子供モードに戻る
```

### セキュリティ
- PIN認証で親モードを保護
- 子供は親機能にアクセス不可
- 親はいつでも子供モードに戻れる

この設計で実装しますか？
