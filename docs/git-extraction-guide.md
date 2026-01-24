# tools/master-piece を履歴付きで独立リポジトリ化する手順

## 概要

`tools/master-piece` ディレクトリを、Git履歴を保持したまま独立したリポジトリとして切り出す方法を説明します。

## 方法1: git filter-repo（推奨）

最も綺麗で効率的な方法です。

### 前提条件

```bash
# git-filter-repo のインストール
pip install git-filter-repo
```

### 手順

#### 1. 作業用クローンを作成

```bash
# 元のリポジトリをクローン（作業用）
git clone https://github.com/your-username/self-consultation.git master-piece-export
cd master-piece-export
```

#### 2. tools/master-piece のみを抽出してルートに移動

```bash
# tools/master-piece 以下のファイルのみを残し、ルートディレクトリに移動
git filter-repo --subdirectory-filter tools/master-piece/
```

この操作により：
- `tools/master-piece/` 以下のファイルがリポジトリのルートに移動
- 他のファイルの履歴は削除
- `tools/master-piece/` に関連するコミット履歴のみが保持される

#### 3. 新しいリポジトリにプッシュ

```bash
# 新しいリモートリポジトリを追加
git remote add origin https://github.com/your-username/master-piece.git

# プッシュ
git push -u origin main
```

### 結果

- `tools/master-piece/src/app/page.tsx` → `src/app/page.tsx`
- `tools/master-piece/package.json` → `package.json`
- すべてのコミット履歴が保持される
- コミットメッセージもそのまま残る

## 方法2: git subtree split（代替案）

`git-filter-repo` が使えない場合の代替手段です。

### 手順

#### 1. 作業用ブランチを作成

```bash
cd self-consultation
git subtree split --prefix=tools/master-piece -b master-piece-only
```

#### 2. 新しいリポジトリにプッシュ

```bash
# 一時ディレクトリを作成
mkdir ../master-piece-new
cd ../master-piece-new
git init

# 作業用ブランチをプル
git pull ../self-consultation master-piece-only

# 新しいリモートにプッシュ
git remote add origin https://github.com/your-username/master-piece.git
git push -u origin main
```

#### 3. クリーンアップ

```bash
cd ../self-consultation
git branch -D master-piece-only
```

## 方法3: 簡易版（履歴なし）

履歴が不要な場合の最も簡単な方法です。

```bash
# 新しいディレクトリを作成
mkdir master-piece-new
cd master-piece-new

# ファイルをコピー
cp -r ../self-consultation/tools/master-piece/* .

# Gitリポジトリとして初期化
git init
git add .
git commit -m "Initial commit"

# リモートにプッシュ
git remote add origin https://github.com/your-username/master-piece.git
git push -u origin main
```

## 推奨事項

### 方法1（git filter-repo）を推奨する理由

1. **最も綺麗**: ディレクトリ構造が自然にルートに移動
2. **高速**: 大規模リポジトリでも効率的
3. **完全な履歴**: すべてのコミット情報が保持される
4. **メンテナンス性**: 将来的な更新も追跡可能

### 移行後の確認事項

移行後、以下を確認してください：

```bash
# 履歴が正しく保持されているか確認
git log --oneline

# ファイル構造の確認
ls -la

# 動作確認
npm install
npm run dev
```

## トラブルシューティング

### git-filter-repo がインストールできない

```bash
# pipが使えない場合、手動インストール
git clone https://github.com/newren/git-filter-repo.git
cd git-filter-repo
sudo cp git-filter-repo /usr/local/bin/
```

### "refusing to overwrite" エラー

```bash
# リモートを削除してから再追加
git remote remove origin
git remote add origin <新しいURL>
```

### 履歴が多すぎて時間がかかる

```bash
# 浅いクローンを使用（最近の履歴のみ）
git clone --depth 100 <元のリポジトリURL>
```

## 参考資料

- [git-filter-repo 公式ドキュメント](https://github.com/newren/git-filter-repo)
- [Git Subtree 公式ドキュメント](https://git-scm.com/docs/git-subtree)
