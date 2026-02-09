# Firebase auth/unauthorized-domain エラー

## 発生した事象

Cloud Run にデプロイした Next.js アプリで、Firebase Authentication の Google ログイン（ポップアップ方式）を実行すると、ログインが失敗する。

ブラウザコンソールに以下のエラーが表示される:

```
FirebaseError: Firebase: Error (auth/unauthorized-domain).
```

また、iframe.js から以下の警告も出力される:

```
Info: The current domain is not authorized for OAuth operations.
This will prevent signInWithPopup, signInWithRedirect, linkWithPopup
and linkWithRedirect from working.
Add your domain (kids-science-lab-572758467709.asia-northeast1.run.app)
to the OAuth redirect domains list in the Firebase console
-> Authentication -> Settings -> Authorized domains tab.
```

Firebase の初期化自体は成功しており、Auth の状態監視も動作しているが、ログイン操作の段階でブロックされる。

```
[Firebase] Initializing with config: Object { apiKey: "AIzaSyC_GU...", ... }
[Firebase] Initialized successfully
[AuthContext] Auth state changed: No user
```

## 原因

Firebase Authentication では、OAuth ログイン（Google ログインなど）を許可するドメインをホワイトリストで管理している。
Cloud Run にデプロイした際の新しいドメイン（例: `xxx.asia-northeast1.run.app`）がこのリストに登録されていなかったため、ログインリクエストが拒否された。

デフォルトで登録されているドメイン:
- `localhost`
- `your-project.firebaseapp.com`
- `your-project.web.app`

Cloud Run のドメインは自動登録されないため、手動で追加する必要がある。

## 解決方法

1. [Firebase コンソール](https://console.firebase.google.com/) を開く
2. 対象プロジェクトを選択
3. 左メニューから **Authentication** を選択
4. **設定** タブを開く
5. **承認済みドメイン** セクションで **ドメインを追加** をクリック
6. Cloud Run のドメインを入力して保存

```
例: kids-science-lab-572758467709.asia-northeast1.run.app
```

登録後、即座に反映される（再デプロイ不要）。

## 注意点

- Cloud Run のサービスを再作成したり、リージョンを変更するとドメインが変わるため、再登録が必要
- カスタムドメインを設定した場合も、そのドメインを別途登録する必要がある
- 開発環境の `localhost` はデフォルトで登録済みなので、ローカルでは問題なく動作する（本番デプロイ時に初めて気づきやすい）
