# Firestore 複合インデックスエラーの解説

## 📌 事象

親ダッシュボード（`/parent`）にアクセスすると、以下のエラーが発生し子供の情報が表示されなかった。

```
FirebaseError: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/...
```

---

## 🔍 原因

Firestore に対して「複合クエリ」を実行したが、対応する「複合インデックス」が存在しなかったため。

### 問題のコード

```typescript
// src/lib/firebase/firestore.ts
const q = query(
  collection(db, 'children'),
  where('parentUserId', '==', parentUserId),  // フィルター①
  where('isActive', '==', true),              // フィルター②
  orderBy('createdAt', 'desc')                // ソート
);
```

このクエリは3つのフィールド（`parentUserId`, `isActive`, `createdAt`）を組み合わせている。
Firestore ではこのような複合クエリに対して、事前にインデックスを作成しておく必要がある。

---

## 📚 背景知識: Firestore のインデックスの仕組み

### 単一フィールドインデックス（自動作成）

Firestore はすべてのフィールドに対して自動的に単一フィールドインデックスを作成する。
そのため、以下のようなシンプルなクエリはインデックス作成なしで動く。

```typescript
// ✅ これは動く（単一フィールドのみ）
where('parentUserId', '==', parentUserId)
```

### 複合インデックス（手動作成が必要）

複数のフィールドを組み合わせたクエリには、複合インデックスが必要。

```typescript
// ❌ これはインデックスなしでは動かない
where('parentUserId', '==', parentUserId) + where('isActive', '==', true) + orderBy('createdAt', 'desc')
```

### なぜ自動作成しないのか？

- 複合インデックスはストレージとコストを消費する
- すべての組み合わせを自動作成すると膨大な数になる
- 開発者が必要なものだけを明示的に作成する設計思想

### インデックス作成にかかる時間

- 数分〜10分程度かかる
- Firebase Console で「ビルド中 🔄」→「有効 ✅」になるまで待つ必要がある
- ビルド中にクエリを実行すると同じエラーが出る

---

## ✅ 解決策

### 方法A: Firebase Console でインデックスを作成する

エラーメッセージに含まれるURLをクリックすると、Firebase Console のインデックス作成画面が開く。
「インデックスを作成」ボタンを押して、ステータスが「有効」になるまで待つ。

作成するインデックス:

| コレクション | フィールド | 順序 |
|-------------|-----------|------|
| children | parentUserId | Ascending |
| children | isActive | Ascending |
| children | createdAt | Descending |

### 方法B: インデックス不要なクエリに書き換える（今回採用）

そもそも AuthContext に `childrenIds`（子供IDの配列）が既に保持されていたため、
複合クエリを使わず、個別に `getChildProfile(childId)` を呼ぶ方式に変更した。

```typescript
// Before: 複合インデックスが必要
const children = await getChildrenByParent(parentUserId);

// After: インデックス不要（IDで直接取得）
const children = await Promise.all(
  childrenIds.map(id => getChildProfile(id))
);
```

単一ドキュメントの取得（`getDoc`）にはインデックスが不要なため、この方法ならインデックス作成を待たずに即座に動作する。

---

## 💡 Tips: 複合インデックスが必要になるパターン

```typescript
// ❌ where + where（異なるフィールド）
where('status', '==', 'completed') + where('createdAt', '>=', startDate)

// ❌ where + orderBy（異なるフィールド）
where('parentUserId', '==', uid) + orderBy('createdAt', 'desc')

// ✅ where + orderBy（同じフィールド）→ 不要
where('createdAt', '>=', startDate) + orderBy('createdAt', 'desc')

// ✅ 等価フィルターのみ（orderByなし）→ 不要な場合が多い
where('parentUserId', '==', uid) + where('isActive', '==', true)
```

### 開発時のベストプラクティス

1. エラーメッセージのURLからワンクリックでインデックスを作成できる
2. `firebase.json` にインデックス定義を書いておくと `firebase deploy` で一括作成できる
3. 可能であれば、既存のデータ（IDの配列など）を活用してインデックス不要な設計にする
4. 開発初期にクエリパターンを洗い出し、必要なインデックスを先に作成しておくとスムーズ

---

## 📎 参考リンク

- [Firestore インデックスの管理（公式ドキュメント）](https://firebase.google.com/docs/firestore/query-data/indexing)
- [複合クエリとインデックス（公式ドキュメント）](https://firebase.google.com/docs/firestore/query-data/queries#compound_and_queries)
