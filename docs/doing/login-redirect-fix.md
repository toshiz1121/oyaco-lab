# ログイン後の画面遷移が動作しない問題の修正

## 問題の概要

Googleログイン成功後、子供選択画面（`/select-child`）に自動遷移せず、ページをリロードしないと遷移しない。

## 原因

レースコンディション（競合状態）とバウンス問題の2つが組み合わさっていた。

### 1. onAuthStateChanged の loading 管理不備

`AuthContext` の `onAuthStateChanged` リスナーは、認証状態が変わった際に Firestore から親ユーザー情報を非同期で取得する。しかし、2回目以降の発火時に `loading` を `true` に戻していなかったため、Firestore 取得中にも関わらず `loading` が `false` のままになる中間状態が発生していた。

```
// 修正前のフロー
onAuthStateChanged 発火
  → setUser(firebaseUser)     // user はセットされる
  → await getParentUser(...)  // Firestore取得中...この間 loading は false のまま
  → setLoading(false)         // 既に false なので変化なし
```

### 2. signInWithGoogle で user/parentUserId を即座にセットしていなかった

`signInWithPopup` 成功後、`onAuthStateChanged` リスナーに状態更新を任せていたが、リスナーの非同期処理完了前に `router.push('/select-child')` が実行されるため、遷移先で状態が未確定だった。

### 3. select-child のガード条件が parentUserId に依存していた

`select-child` ページの認証ガードが `parentUserId`（Firestore 取得後にセットされる）を使っていたため、遷移直後に `parentUserId` が `null` → 未認証と判定 → `/login` にリダイレクトされていた。

```
// バウンスの流れ
login → signInWithGoogle() 成功
  → router.push('/select-child')
  → select-child マウント
  → !loading && !parentUserId → true（parentUserId がまだ null）
  → router.push('/login') ← ここで戻される
```

## 修正内容

### ファイル: `src/contexts/AuthContext.tsx`

#### a. onAuthStateChanged 内で setLoading(true) を追加

認証状態が変わるたびに `loading` を `true` にし、Firestore 取得完了後に `false` にする。

```tsx
const unsubscribe = onAuthStateChanged(firebaseAuth, async(firebaseUser) => {
    setLoading(true);  // ← 追加
    setUser(firebaseUser);
    // ... Firestore取得処理 ...
    setLoading(false);
});
```

#### b. signInWithGoogle 内で即座に状態をセット

`signInWithPopup` 成功直後に `setUser` と `setParentUserId` を呼び、`setLoading(true)` → Firestore取得 → `setLoading(false)` を関数内で完結させた。

```tsx
const signInWithGoogle = async () => {
    try {
        setLoading(true);  // ← 追加
        const result = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;

        setUser(firebaseUser);           // ← 追加
        setParentUserId(firebaseUser.uid); // ← 追加

        // Firestore取得処理...

        setLoading(false);  // ← 追加
    } catch (error) { ... }
};
```

### ファイル: `src/app/select-child/page.tsx`

#### c. ガード条件を user ベースに変更

`parentUserId`（Firestore依存で遅延する）から `user`（Firebase Auth が直接管理、即座に反映される）に変更。

```tsx
// 修正前
const { parentUserId, childrenIds, selectChild, loading } = useAuth();
useEffect(() => {
    if(!loading && !parentUserId) { router.push('/login'); }
}, [parentUserId, loading, router]);

// 修正後
const { user, parentUserId, childrenIds, selectChild, loading } = useAuth();
useEffect(() => {
    if(!loading && !user) { router.push('/login'); }
}, [user, loading, router]);
```

## 修正後のフロー

```
1. ユーザーがGoogleログインボタンを押す
2. signInWithGoogle() 開始 → setLoading(true)
3. signInWithPopup 成功
4. setUser(firebaseUser), setParentUserId(uid) ← 即座にセット
5. Firestore から親ユーザー情報を取得
6. setChildrenIds, setActiveChildId をセット
7. setLoading(false)
8. signInWithGoogle() が resolve
9. router.push('/select-child')
10. select-child マウント → user あり & loading false → ガード通過 ✅
```

## 関連ファイル

- `src/contexts/AuthContext.tsx` - 認証状態管理
- `src/app/login/page.tsx` - ログインページ
- `src/app/select-child/page.tsx` - 子供選択ページ
