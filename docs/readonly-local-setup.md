# Pull専用ローカルリポジトリのセットアップ

`~/master-piece` を**pull専用（読み取り専用）**にして、誤って直接変更をプッシュしないようにする設定方法です。

## 目的

- **開発**: `self-consultation/tools/master-piece` で行う
- **同期**: `git subtree push` で `master-piece` リポジトリに反映
- **確認**: `~/master-piece` で最新状態を確認（pull専用）

## セットアップ手順

### 1. リモートURLを読み取り専用に変更

```bash
cd ~/master-piece

# 現在のリモートURLを確認
git remote -v

# プッシュ用URLを無効化（読み取り専用にする）
git remote set-url --push origin no-push

# 確認
git remote -v
# origin  ssh://git@git.rakuten-it.com:7999/baip/master-piece.git (fetch)
# origin  no-push (push)
```

### 2. プッシュを試みると...

```bash
cd ~/master-piece
git push
# fatal: 'no-push' does not appear to be a git repository
# fatal: Could not read from remote repository.
```

このエラーが出れば、設定成功です！

### 3. プルは通常通り可能

```bash
cd ~/master-piece
git pull origin main
# または
git fetch origin && git checkout -B master-piece-only origin/main
```

## 運用フロー

### 開発時

```bash
# 1. self-consultation で開発
cd /home/king/dev/self-consultation/tools/master-piece
# コードを編集

# 2. コミット & プッシュ
cd /home/king/dev/self-consultation
git add tools/master-piece/...
git commit -m "feat: 新機能追加"
git push

# 3. master-piece リポジトリに同期
git subtree push --prefix=tools/master-piece ssh://git@git.rakuten-it.com:7999/baip/master-piece.git main
```

### 確認時

```bash
# 4. ローカルリポジトリで最新状態を確認
cd ~/master-piece
git pull origin main
# または
git fetch origin && git checkout -B master-piece-only origin/main

# 5. 動作確認
npm run dev
```

## メリット

- ✅ **誤プッシュ防止**: `~/master-piece` から直接プッシュできない
- ✅ **明確な役割分担**: 開発は `self-consultation`、確認は `~/master-piece`
- ✅ **シンプルなワークフロー**: 混乱を防ぐ

## 元に戻す方法

もし `~/master-piece` からもプッシュしたくなった場合：

```bash
cd ~/master-piece
git remote set-url --push origin ssh://git@git.rakuten-it.com:7999/baip/master-piece.git
```

## 推奨設定

この設定を適用することで、以下のワークフローが確立されます：

1. **開発**: `self-consultation/tools/master-piece`（唯一の編集場所）
2. **同期**: `git subtree push`（唯一のプッシュ方法）
3. **確認**: `~/master-piece`（pull専用、動作確認用）

これにより、履歴の分岐や同期の問題を防ぐことができます。
