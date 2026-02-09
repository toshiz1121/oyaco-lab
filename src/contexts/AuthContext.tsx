'use client';

import { useState, createContext, useEffect, useContext } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from "@/lib/firebase/config";
import { getParentUser, createParentUser, updateActiveChild, addChildToParent } from "@/lib/firebase/auth";
import { createChildProfile } from "@/lib/firebase/firestore";

interface AuthContextType {
    user: User | null;
    parentUserId: string | null;
    activeChildId: string | null;
    childrenIds: string[];
    loading: boolean;

    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    selectChild: (childId: string) => Promise<void>;
    addChild: (name: string, age: number) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: {children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [parentUserId, setParentUserId] = useState<string | null>(null);
    const [activeChildId, setActiveChildId] = useState<string | null>(null);
    const [childrenIds, setChildrenIds] = useState<string[]>([]); 
    const [loading, setLoading] = useState(true);   

    // 認証状態の監視
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async(firebaseUser) => {
            console.log('[AuthContext] Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
            setUser(firebaseUser);
            if(firebaseUser) {
                setParentUserId(firebaseUser.uid);

                // 親のユーザー情報を取得
                const parentUser = await getParentUser(firebaseUser.uid);

                if(parentUser) {
                    console.log('[AuthContext] Parent user loaded:', {
                        userId: parentUser.userId,
                        children: parentUser.children,
                        activeChildId: parentUser.activeChildId
                    });
                    setChildrenIds(parentUser.children);
                    setActiveChildId(parentUser.activeChildId || null);
                } else {
                    console.warn('[AuthContext] Parent user not found in Firestore');
                }
            } else {
                setParentUserId(null);
                setActiveChildId(null);
                setChildrenIds([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    },[]);

    // Googleログイン
    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            // Googleでログインした認証情報を取得する
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;

            // データベースから親情報を取得する
            let parentUser = await getParentUser(firebaseUser.uid);

            // 親情報がない場合は、データベースに作成する
            if(!parentUser) {
                parentUser = await createParentUser({
                    userId: firebaseUser.uid,
                    email: firebaseUser.email!,
                    displayName: firebaseUser.displayName || 'ユーザー',
                    photoURL: firebaseUser.photoURL || undefined,
                });
            }

            // 親ユーザー情報にセットされている子供の情報をセットする
            setChildrenIds(parentUser.children);

            // アクティブな子供のIDをセットする
            setActiveChildId(parentUser.activeChildId || null);
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    // ログアウト
    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
            setParentUserId(null);
            setActiveChildId(null);
            setChildrenIds([]);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // 子供を選択
    const selectChild = async (childId: string) => {
        //  親がログインしていない場合は、処理を終了
        if(!parentUserId) return;

        try {
            await updateActiveChild(parentUserId, childId); 
            setActiveChildId(childId);
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    // 子供を追加
    const addChild = async (name: string, age: number): Promise<string> => {
        if (!parentUserId) {
            throw new Error('親ユーザーがログインしていません');
        }

        try {
            // 子供IDを生成（タイムスタンプ + ランダム文字列）
            const childId = `child_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            // Firestoreに子供プロフィールを作成
            await createChildProfile(childId, name, age, parentUserId);

            // 親アカウントのchildren配列に追加
            await addChildToParent(parentUserId, childId);

            // ローカル状態を更新
            setChildrenIds((prev) => [...prev, childId]);
            setActiveChildId(childId); // 新しい子供を自動選択

            console.log(`[AuthContext] 子供を追加しました: ${childId}`);
            return childId;

        } catch (error) {
            console.error('[AuthContext] 子供の追加に失敗:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                parentUserId,
                activeChildId,
                childrenIds,
                loading,
                signInWithGoogle,
                signOut,
                selectChild,
                addChild,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if(context == undefined) {
        throw new Error('error');
    }
    return context;
}