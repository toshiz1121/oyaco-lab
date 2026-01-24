# master-piece リポジトリへの同期方法

このドキュメントでは、`self-consultation/tools/master-piece` で加えた変更を、独立した `master-piece` リポジトリに反映させる方法を説明します。

**最終更新**: 2026-01-06（同期テスト実施）

## 前提条件

- `self-consultation` リポジトリで開発を行っている
- 独立した `master-piece` リポジトリが存在する
  - リポジトリURL: `ssh://git@git.rakuten-it.com:7999/baip/master-piece.git`

## 方法1: git subtree push（推奨）

最も綺麗で、履歴を保持したまま同期できる方法です。

### 手順

```bash
# self-consultation リポジトリに移動
cd /home/king/dev/self-consultation

# tools/master-piece の変更を master-piece リポジトリにプッシュ
git subtree push --prefix=tools/master-piece ssh://git@git.rakuten-it.com:7999/baip/master-piece.git main
```

### メリット
- ✅ コミット履歴が完全に保持される
- ✅ 1コマンドで完了
- ✅ Git標準機能（追加ツール不要）

### デメリット
- ⚠️ 初回は時間がかかる（全履歴を再計算）
- ⚠️ 大量のコミットがある場合は数分かかることも

### トラブルシューティング

**エラー: "Updates were rejected"**
```bash
# リモートの最新状態を確認
git fetch ssh://git@git.rakuten-it.com:7999/baip/master-piece.git main

# 強制プッシュ（注意: リモートの変更を上書き）
git subtree push --prefix=tools/master-piece ssh://git@git.rakuten-it.com:7999/baip/master-piece.git main --force
```

## 方法2: 手動コピー + コミット（シンプル）

ファイルを直接コピーして、手動でコミットする方法です。

### 手順

```bash
# 1. ファイルをコピー（.git と node_modules を除外）
rsync -av --exclude='.git' --exclude='node_modules' \
  /home/king/dev/self-consultation/tools/master-piece/ \
  ~/master-piece/

# 2. master-piece リポジトリでコミット
cd ~/master-piece
git add .
git commit -m "sync: update from self-consultation"
git push origin HEAD:main
```

### メリット
- ✅ シンプルで理解しやすい
- ✅ 高速（ファイルコピーのみ）
- ✅ トラブルが少ない

### デメリット
- ❌ 個別のコミット履歴が失われる（1つのコミットにまとまる）
- ❌ 手動操作が多い

## 方法3: パッチファイル経由（細かい制御が必要な場合）

特定のコミットだけを反映させたい場合に使用します。

### 手順

```bash
# 1. self-consultation で変更をパッチとして抽出
cd /home/king/dev/self-consultation
git format-patch -1 HEAD --relative=tools/master-piece/ -o /tmp/

# 2. master-piece リポジトリでパッチを適用
cd ~/master-piece
git am /tmp/*.patch

# 3. プッシュ
git push origin HEAD:main
```

### メリット
- ✅ 特定のコミットだけを選択的に反映可能
- ✅ コミットメッセージと作者情報が保持される

### デメリット
- ❌ 手順が複雑
- ❌ パッチの競合が発生する可能性

## 推奨ワークフロー

日常的な開発では、以下のワークフローを推奨します：

### 開発フェーズ
1. `self-consultation/tools/master-piece` で開発
2. 通常通りコミット・プッシュ

### 同期フェーズ（週1回程度）
1. `git subtree push` で `master-piece` リポジトリに反映
2. 動作確認

### 公開フェーズ
1. `master-piece` リポジトリから本番デプロイ

## よくある質問

### Q: どのくらいの頻度で同期すべきですか？

A: 以下のタイミングで同期することを推奨します：
- 新機能の完成時（Phase完了時）
- バグ修正後
- 週1回の定期同期

### Q: 同期を忘れた場合、どうなりますか？

A: `self-consultation` と `master-piece` の内容が乖離しますが、次回の `git subtree push` で自動的に同期されます。ただし、コンフリクトが発生する可能性があります。

### Q: master-piece リポジトリで直接変更を加えた場合は？

A: 推奨しません。すべての変更は `self-consultation/tools/master-piece` で行い、`git subtree push` で同期してください。

もし `master-piece` で直接変更した場合は、以下の手順で `self-consultation` に反映できます：

```bash
cd /home/king/dev/self-consultation
git subtree pull --prefix=tools/master-piece ssh://git@git.rakuten-it.com:7999/baip/master-piece.git main
```

## 参考資料

- [Git Subtree 公式ドキュメント](https://git-scm.com/docs/git-subtree)
- [git-extraction-guide.md](./git-extraction-guide.md) - 初回抽出時の手順
