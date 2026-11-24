# errors

## Overview

- 共通エラー型: サーバー側の `DomainError` と、クライアント側の `HttpError` の 2 つの型と、その変換ユーティリティ
- 外部の口(DB・Firebase・Storage・メールの webhook)の env が未設定のときの誤りの共通の親 `BackendNotConfiguredError` と判定 `isBackendNotConfiguredError`
- 層をまたいだエラーの流れ（どの層が何に責任を持つか、なぜこの形か）は [docs/!must-read/エラーハンドリング方針.md](../../../docs/!must-read/エラーハンドリング方針.md)（CLAUDE.md ARCHITECTURE errors）
- 使う時の決まりは札 .claude/rules/items/lib/errors.md にある

```ts
import { DomainError, err, normalizeHttpError, createHttpError } from "@/lib/errors";
```

## Usage

### サーバーサービスで投げる

```ts
throw new DomainError("この操作は管理者のみ実行できます", { status: 403 });
```

### クライアントサービス

```ts
try {
  const { data } = await axios.post("/api/sample", input);
  return data;
} catch (error) {
  throw normalizeHttpError(error, "保存に失敗しました");
}
```

- `createApiClient`（`@/lib/crud`）で作る CRUD クライアントはこの正規化を内部で行う

### UI（フックの mutation を呼ぶ側）

```tsx
try {
  await trigger(data);
  showToast("登録しました", "success");
} catch (error) {
  showToast(err(error, "登録に失敗しました"), "error");
}
```

- `status` で分岐したいときは `normalizeHttpError(error).status === 409` のように確認する
- 外部の口の誤りは `isBackendNotConfiguredResponse(error)`(500、設定の誤り)・`isBackendNotSelectedResponse(error)`(501、その機能を使わない構成)で見分ける
- メンテナンス中に止められた書き込み(503)は `isMaintenanceError(error)` で見分ける。文言は `err(error, fallback)` でサーバーの「メンテナンス中」が出るので、入力は残したまま知らせるだけでよい(画面の移動は `@/lib/appStatus` の `useAppStatus` が受け持つ)

## API

### `DomainError`（`domainError.ts`、サーバー側）

- ユーザーへ伝えるべき失敗（ビジネスルール違反・権限不足・存在しない等）を表す例外
- `status` を省略すると `400`
- `code`（機械可読な分類）・`details`（補足の値）は省略可。指定するとルートの応答 body に `code` / `details` として載る。body の組み立ては `toDomainErrorBody(error)`
- 判定は `isDomainError(error)`

### `BackendNotConfiguredError`（`backendNotConfiguredError.ts`、client / server 共通）

- 外部の口の env が未設定のまま、それを要する処理に到達したときの誤りの共通の親。`DomainError` ではない(利用者に見せる業務の誤りではなく、環境の不足)
- 欄(readonly): `port`(口の名前)・`implementation?`(口の実装の名前)・`missing`(足りない env の名前の配列、値は入れない)・`side`(`"client"` | `"server"`)
- 生成は `new BackendNotConfiguredError(message, { port, implementation?, missing, side })`(型 `BackendNotConfiguredErrorOptions`)。各口の誤りが継ぎ、`name` は子が自分の名前で書き直す
- 判定は `isBackendNotConfiguredError(error)`(どの口の未設定でも true)。口ごとに分けるときは子のクラスの `instanceof`
- API の応答: routeFactory が 500 + `{ message: 汎用, code: "backend_not_configured" }` に写す(子の `BackendNoneSelectedError`、`@/lib/backends` は 501 + `code: "backend_not_selected"`)。`port`・`implementation`・`missing` は応答に載らない
- 判定は「未設定」のみ。設定済みで到達できない障害には使わない(障害を未設定扱いで覆い隠さない)

| 子のクラス | 置き場 | `port` | `implementation` | `missing` | `side` |
|---|---|---|---|---|---|
| `DatabaseNotConfiguredError` | `@/lib/drizzle` | `"database"` | なし | `["DATABASE_URL"]` | `"server"` |
| `FirebaseNotConfiguredError(side)` | `@/lib/firebase` | `"firebase"` | なし | client `["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"]` / server `["MY_SERVICE_ACCOUNT_KEY"]` | 引数のまま |
| `StorageNotConfiguredError(store, missing)` | `@/lib/storage/server` | `"storage"` | 保存先 `store` | 引数のまま | `"server"` |
| `WebhookNotConfiguredError(provider)` | messaging の `services/server/webhooks` | `"mail"` | `provider`(`"resend"` / `"sendgrid"`) | その webhook の鍵の env 名 | `"server"` |

### `HttpError`（`httpError.ts`、クライアント側）

クライアント層で扱う唯一のエラー型。`message` / `status?` / `responseData?` / `cause?` を持つ。

| 関数 | 用途 |
|---|---|
| `normalizeHttpError(error, fallback?, options?)` | 任意の例外を `HttpError` に正規化する。クライアントサービスの `catch` で通す(.claude/rules/core/client.md client_layer)。`HttpError` はそのまま、axios エラーはレスポンスボディの `message` を優先して採用し `status` / `responseData` を保持、その他の `Error` は `message` を引き継ぐ |
| `options.rethrowStatuses` | 指定したステータスだけ正規化せず元の例外を再 throw する（例: 428 を呼び出し元で個別処理する） |
| `createHttpError({ message, status?, responseData?, cause? })` | HTTP 通信を介さない失敗（外部 SDK、ブラウザ API、クライアント側の検証）を `HttpError` として新たに作る。空文字の `message` は既定文言に置き換わる |
| `err(error, fallback)` | UI で表示文言を得る。`resolveErrorMessage` の短縮形。内部で `normalizeHttpError` を通すので、想定外の値が来ても必ず文字列を返す |
| `isHttpError(error)` | 型ガード。通常は `normalizeHttpError` / `err` が代わりに担う |
| `getErrorCode(error)` | `responseData` の `code`（文字列）を返す。`HttpError` でない、または無ければ `null`。`status` だけでは区別できないエラーの分岐に使う |
| `isMaintenanceError(error)` | メンテナンス中に止められたエラーか(`code` が `MAINTENANCE_CODE`)。503 は `route_user_unavailable` も使うので `status` では分けない |
| `MAINTENANCE_CODE` | メンテナンスで止めた応答の `code`(`"maintenance"`)。サーバー(routeFactory)とクライアントが読む 1 つ |
| `isBackendNotConfiguredResponse(error)` | 外部の口の設定が無くて失敗した応答か(`code` が `BACKEND_NOT_CONFIGURED_CODE`、番号は 500) |
| `isBackendNotSelectedResponse(error)` | 使わないと選んだ口の機能を呼んだ応答か(`code` が `BACKEND_NOT_SELECTED_CODE`、番号は 501) |
| `BACKEND_NOT_CONFIGURED_CODE` / `BACKEND_NOT_SELECTED_CODE` | 外部の口の応答の `code`(`"backend_not_configured"` / `"backend_not_selected"`)。routeFactory が書き、クライアントが読む |
| `getErrorDetails(error)` | `responseData` の `details`（オブジェクト）を返す。`HttpError` でない、または無ければ `null` |

- 既定のフォールバック文言は `リクエストに失敗しました`

## Internals

### ルートでの変換

- routeFactory のファクトリーが `DomainError` を catch して `{ message, code?, details? }` + `status` の JSON に変換する（`src/lib/routeFactory/createApiRoute.ts`）
- `DomainError` 以外の例外は `{ message: "サーバーでエラーが発生しました" }` + 500 に置き換わり、元の `message` はサーバーログ（`console.error`）にだけ残る
- メンテナンス中の書き込みの停止は Factory が直接 `{ message, code: MAINTENANCE_CODE }` + 503 を返す（`DomainError` ではないので、500 以上の失敗の記録には渡らない。`src/lib/routeFactory/maintenance.ts`）

### 時間切れ

- client の axios の呼び出しのタイムアウトは呼び出しごと(CRUD の通常の操作は 60 秒)。自分の値を持たない呼び出しへのアプリ全体の既定は [`src/lib/httpDefaults`](../httpDefaults/README.md)(設定 `timeoutMs`、既定は付けない。外す印 `defaultTimeout: false`)。時間切れも axios のエラーとして `normalizeHttpError` を通る

### 開発中の 401 / 403 の警告

- 開発中のブラウザでは、`normalizeHttpError` が axios の 401 / 403 を `console.warn` に出す（本番とサーバー側では出ない。`rethrowStatuses` で再 throw するステータスも出ない）
- 認可の拒否が「データ 0 件」に見えて気づけないのを防ぐためで、ボディに `domain` / `operation` があれば併記する。ログアウト中のセッション確認など、想定内の 401 でも出る

### アプリ全体の集約ポイント

`createApiClient` 経由の通信だけが対象（独自に axios を呼ぶクライアントサービスには効かない）。

- `setApiErrorHandler(handler)`（`src/lib/crud/client/apiClientFactory.ts`）: 失敗したリクエストの `HttpError` を 1 か所で受け取る。既定は status 500 以上を `console.error` するだけ。監視サービスへの送信などに差し替える
- `registerCrudEventHandler(handler)`（`src/lib/crud/client/events.ts`）: CRUD 操作ごとに `{ action, success, error? }` が届く。計測・リトライ指示など UI 以外の集約に使う
