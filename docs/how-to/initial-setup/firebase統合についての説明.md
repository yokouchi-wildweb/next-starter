# Firebase 設定

Firebase の設定ファイルはブラウザ用 SDK と Admin SDK で共通の値を利用します。クライアント・サーバー両方のコードで同じ `.env` を参照できるようにしておくと運用が容易です。

## 環境変数とサービスアカウント

サーバー側では、Firebase コンソールからダウンロードしたサービスアカウントキーの JSON を **環境変数 `MY_SERVICE_ACCOUNT_KEY` にそのまま格納** して Firebase Admin SDK を初期化します。Cloud Run などのホスティング環境では秘密情報を Secret Manager などで管理し、この環境変数へ渡してください。

`.env` には以下のように各種公開設定とサービスアカウントキーの JSON を記述します。

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
MY_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }'
```

サーバーコードでは `MY_SERVICE_ACCOUNT_KEY` が設定されていればそれをパースし、指定がない場合は `applicationDefault()` を利用します。Google Cloud のマネージドサービス上ではランタイムにアタッチされたサービスアカウントが使われます。

Firebase 関連のユーティリティは `src/lib/firebase` 以下で `client/` と `server/` に分けています。

## クライアント側での利用

ブラウザ用 SDK は `src/lib/firebase/client` に配置しています。

- `app.ts`: `initializeApp` でブラウザ用の Firebase アプリを生成し、`auth` / `fstore` / `storage` をエクスポートします。

Firebase Storage をブラウザから直接操作する場合は `src/lib/storage/client/directStorageClient.ts` を利用します。通常は `src/lib/storage` のクライアントやフック経由でアップロード／削除処理を呼び出してください。

## サーバー側での利用

サーバー用のユーティリティは `src/lib/firebase/server` にあります。すべて Admin SDK ベースなので、クライアント SDK と異なり秘密情報を扱う処理を安全に実行できます。

### Admin SDK の初期化

`server/app.ts` の `getServerApp()` は Firebase Admin アプリをシングルトンで初期化・取得します。サービスアカウント JSON を環境変数から読み込み、`projectId` や `storageBucket` にはクライアントと同じ環境変数を用います。

```ts
import { getServerApp } from "@/lib/firebase/server/app";

const app = getServerApp();
```

### Firestore を扱う

`server/app.ts` が提供する `getServerFirestore()` を使うと、Admin SDK の Firestore インスタンスにアクセスできます。サーバーアクションや Route Handler など、サーバーで実行される場所から利用してください。

```ts
import { getServerFirestore } from "@/lib/firebase/server/app";

const firestore = getServerFirestore();

export async function getUserDoc(uid: string) {
  const snap = await firestore.collection("users").doc(uid).get();
  return snap.exists ? snap.data() : undefined;
}
```

Admin SDK ではセキュリティルールを経由せずにアクセスできるため、必要に応じて適切な認可チェックを行ってください。

### Storage を扱う

`server/storage.ts` には Storage へアクセスするためのヘルパーを用意しています。

- `uploadFileServer(path, buffer, contentType?)`: Buffer を指定したパスに保存し、公開 URL を返します。
- `deleteFileServer(path)`: 指定したパスのファイルを削除します。
- `getPathFromStorageUrl(url)`: Storage の公開 URL からパス部分だけを取り出します。クライアント用の同名関数と挙動は同じです。

```ts
import { uploadFileServer, deleteFileServer } from "@/lib/firebase/server/storage";

export async function saveImage(uid: string, buffer: Buffer) {
  const path = `users/${uid}/profile.png`;
  const url = await uploadFileServer(path, buffer, "image/png");
  return { path, url };
}

export async function removeImage(path: string) {
  await deleteFileServer(path);
}
```

### Next.js での利用例

Next.js のサーバーアクションで画像をアップロードする例です。

```ts
"use server";

import { uploadFileServer } from "@/lib/firebase/server/storage";

export async function uploadAvatarAction(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return uploadFileServer(`avatars/${file.name}`, buffer, file.type);
}
```

このようにサーバーサイドのコードでは Admin SDK を利用し、ブラウザから直接アクセスさせたくない処理を安全に実装できます。
