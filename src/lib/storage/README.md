# `src/lib/storage`

このディレクトリは、Firebase Storage をアプリケーション全体で扱うための共通サービスレイヤーを提供します。ブラウザ／サーバーのいずれからでも再利用できるように、HTTP エンドポイント・クライアント・React フックを一箇所にまとめています。

## 役割

- `client/` … `/api/storage/*` エンドポイントを呼び出す axios クライアントを提供します。
- `server/` … ファイルアップロード・削除処理をアプリ都合に合わせてラップし、ファイル名生成 (`uuidv7`) や URL からパスへの変換を担います。
- `hooks/` … UI コンポーネントから使いやすいよう、アップロード〜削除のライフサイクルを隠蔽した React フックを公開します。
- `form.ts` … 上記の共有型を定義します。

いずれのレイヤーも、Firebase SDK 自体に依存するのではなく、`/api/storage` 経由でアプリ共通の振る舞いを提供することが目的です。

## ⚠️ `/api/storage/*` は暫定で管理者専用

- `/api/storage/upload`・`/api/storage/delete`（= `useAppStorage` / `appStorageClient` の経路）は、保存先・所有者の検証を持たないため、管理者カテゴリのみに制限している（未ログイン 401 / 一般ユーザー 403）
- 一般ユーザー向けの画面からこの経路を使わない。一般ユーザーのアップロード・削除の権限設計（ポリシー定義・署名付き URL・エンジン抽象化）は再設計中: council `20261022-121853-storage-authority-policy-redesign`
- クライアント直経路（`clientUploader` / `directStorageClient` / `useDirectStorage`）の権限は Firebase Storage ルールだけが判定する。ルールは upstream に同梱していないため、各環境で書き込み先のパスを絞ること（`request.auth != null` だけでは、ログインユーザーなら誰でも任意のファイルを上書き・削除できる）

## `src/lib/firebase/*` との違い

`src/lib/firebase` 配下は Firebase SDK を直接操作するための低レイヤーラッパーであり、保存先パスを受け取りアップロード／削除するだけの最小限の責務を担います。

一方 `src/lib/storage` はそのラッパーを組み合わせ、

- アップロードするファイルの命名規則や保存ディレクトリの制御
- API Route（`/api/storage/upload`・`/api/storage/delete`）との通信
- エラーハンドリングや UI からの利用を意識したフック

といったアプリケーション固有の要件を実装しています。Firebase SDK の詳細を知らなくても、こちらの API を利用するだけで共通のストレージ処理を扱えるのが狙いです。

## 利用指針

- **通常のドメイン／UI コードからは `src/lib/storage` の API を使ってください。** フォームやアップローダーは `useAppStorage` や `useDirectStorage` などのフック経由で利用するのが基本です。
- Firebase SDK の細かなオプション調整など、アプリ共通のラッパーでは対応できない特殊なケースのみ、`src/lib/firebase/*` を直接参照します。その際は使用理由をコメントで残すと、責務分担が把握しやすくなります。

この構成により、複数ドメインから同じストレージ処理を安全かつ一貫したインターフェースで利用できます。
