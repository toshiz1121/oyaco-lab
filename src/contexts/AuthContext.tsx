'use client';

import { useState, createContext, useEffect, useContext } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  type Auth
} from 'firebase/auth';
import { getFirebaseAuth } from "@/lib/firebase/config";
import { getParentUser, createParentUser, updateActiveChild, addChildToParent } from "@/lib/firebase/auth";
import { createChildProfile, getChildProfile } from "@/lib/firebase/firestore";
import type { ChildProfile } from "@/lib/firebase/types";

interface AuthContextType {
    user: User | null;
    parentUserId: string | null;
    activeChildId: string | null;
    childrenIds: string[];
    childProfiles: ChildProfile[];
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
    const [childProfiles, setChildProfiles] = useState<ChildProfile[]>([]);
    const [loading, setLoading] = useState(true);   

    // childrenIds が変わったら子供プロフィールをフェッチ
    useEffect(() => {
        if (childrenIds.length === 0) {
            setChildProfiles([]);
            return;
        }
        const fetchProfiles = async () => {
            const profiles = await Promise.all(
                childrenIds.map(id => getChildProfile(id))
            );
            setChildProfiles(profiles.filter((p): p is ChildProfile => p !== null));
        };
        fetchProfiles();
    }, [childrenIds]);

    // 認証状態の監視
    useEffect(() => {
        // Firebase auth が初期化可能か確認
        let firebaseAuth: Auth;
        
        const initAuth = async () => {
            try {
                firebaseAuth = await getFirebaseAuth();
            } catch (error) {
                console.error('[AuthContext] Firebase auth is not initialized:', error);
                setLoading(false);
                return;
            }
            
            const unsubscribe = onAuthStateChanged(firebaseAuth, async(firebaseUser) => {
                console.log('[AuthContext] Auth state changed:', firebaseUser ? `User: ${firebaseUser.uid}` : 'No user');
                setLoading(true);
                setUser(firebaseUser);
                if(firebaseUser) {
                    setParentUserId(firebaseUser.uid);

                    // 親のユーザー情報を取得
                    try {
                        const parentUser = await getParentUser(firebaseUser.uid);

                        if(parentUser) {
                            setChildrenIds(parentUser.children);
                            setActiveChildId(parentUser.activeChildId || null);
                        } else {
                            console.warn('[AuthContext] Parent user not found in Firestore');
                            // 親ユーザーが存在しない場合は空の状態を設定
                            setChildrenIds([]);
                            setActiveChildId(null);
                        }
                    } catch (error) {
                        console.error('[AuthContext] Failed to fetch parent user:', error);
                        // エラー時も空の状態を設定してUIをブロックしない
                        setChildrenIds([]);
                        setActiveChildId(null);
                    }
                } else {
                    setParentUserId(null);
                    setActiveChildId(null);
                    setChildrenIds([]);
                }
                setLoading(false);
            });
            
            return unsubscribe;
        };
        
        let unsubscribe: (() => void) | undefined;
        initAuth().then(unsub => {
            unsubscribe = unsub;
        });
        
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    },[]);

    // Googleログイン
    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            setLoading(true);
            
            // Firebase authを取得
            const firebaseAuth = await getFirebaseAuth();
            
            // Googleでログインした認証情報を取得する
            const result = await signInWithPopup(firebaseAuth, provider);
            const firebaseUser = result.user;
            console.log('[AuthContext] Google sign-in successful:', firebaseUser.uid);

            // ログイン成功時点で即座にuser/parentUserIdをセット
            setUser(firebaseUser);
            setParentUserId(firebaseUser.uid);

            // データベースから親情報を取得する
            try {
                let parentUser = await getParentUser(firebaseUser.uid);

                // 親情報がない場合は、データベースに作成する
                if(!parentUser) {
                    console.log('[AuthContext] Parent user not found, creating new...');
                    parentUser = await createParentUser({
                        userId: firebaseUser.uid,
                        email: firebaseUser.email!,
                        displayName: firebaseUser.displayName || 'ユーザー',
                        photoURL: firebaseUser.photoURL || undefined,
                    });
                    console.log('[AuthContext] Parent user created successfully');
                } else {
                    console.log('[AuthContext] Parent user found:', parentUser.userId);
                }

                // 親ユーザー情報にセットされている子供の情報をセットする
                setChildrenIds(parentUser.children);

                // アクティブな子供のIDをセットする
                setActiveChildId(parentUser.activeChildId || null);
            } catch (firestoreError) {
                console.error('[AuthContext] Firestore operation failed during sign-in:', firestoreError);
                // Firestoreエラーでもログイン自体は成功させる
            }
            
            setLoading(false);
            console.log('[AuthContext] Sign-in complete');
        } catch (error) {
            console.error('[AuthContext] ログイン失敗：', error);
            throw error;
        }
    };

    // ログアウト
    const signOut = async () => {
        try {
            const firebaseAuth = await getFirebaseAuth();
            await firebaseSignOut(firebaseAuth);
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
                childProfiles,
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