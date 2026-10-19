# errors - 共通エラー型

サーバー側の `DomainError` と、クライアント側の `HttpError` の 2 つの型と、その変換ユーティリティ。
層をまたいだエラーの流れ（どの層が何に責任を持つか、なぜこの形か）は [docs/!must-read/エラーハンドリング方針.md](../../../docs/!must-read/エラーハンドリング方針.md) を参照。

```ts
import { DomainError, err, normalizeHttpError, createHttpError } from "@/lib/errors";
```

## サーバー側: `DomainError`（`domainError.ts`）

ユーザーへ伝えるべき失敗（ビジネスルール違反・権限不足・存在しない等）を表す例外。サーバーサービスが throw する。

```ts
throw new DomainError("この操作は管理者のみ実行できます", { status: 403 });
```

- `status` を省略すると `400`
- `message` はそのままユーザーに表示される前提で書く（日本語・次の行動が分かる文言）
- 判定は `isDomainError(error)`
- routeFactory の 3 ファクトリーが catch して `{ message }` + `status` の JSON に変換する（`src/lib/routeFactory/createApiRoute.ts`）。サーバーサービス以外（API ルートのハンドラ内など）で新たに throw しない

## クライアント側: `HttpError`（`httpError.ts`）

クライアント層で扱う唯一のエラー型。`message` / `status?` / `responseData?` / `cause?` を持つ。

| 関数 | 用途 |
|---|---|
| `normalizeHttpError(error, fallback?, options?)` | 任意の例外を `HttpError` に正規化する。クライアントサービスの `catch` で必ず通す。`HttpError` はそのまま、axios エラーはレスポンスボディの `message` を優先して採用し `status` / `responseData` を保持、その他の `Error` は `message` を引き継ぐ |
| `options.rethrowStatuses` | 指定したステータスだけ正規化せず元の例外を再 throw する（例: 428 を呼び出し元で個別処理する） |
| `createHttpError({ message, status?, responseData?, cause? })` | HTTP 通信を介さない失敗（外部 SDK、ブラウザ API、クライアント側の検証）を `HttpError` として新たに作る。空文字の `message` は既定文言に置き換わる |
| `err(error, fallback)` | UI で表示文言を得る。`resolveErrorMessage` の短縮形。内部で `normalizeHttpError` を通すので、想定外の値が来ても必ず文字列を返す |
| `isHttpError(error)` | 型ガード。通常は `normalizeHttpError` / `err` が代わりに担う |

既定のフォールバック文言は `リクエストに失敗しました`。

## 使い方

**クライアントサービス**

```ts
try {
  const { data } = await axios.post("/api/sample", input);
  return data;
} catch (error) {
  throw normalizeHttpError(error, "保存に失敗しました");
}
```

`createApiClient`（`@/lib/crud`）で作る CRUD クライアントはこの正規化を内部で行う。

**UI（フックの mutation を呼ぶ側）**

```tsx
try {
  await trigger(data);
  showToast("登録しました", "success");
} catch (error) {
  showToast(err(error, "登録に失敗しました"), "error");
}
```

`status` で分岐したいときは `normalizeHttpError(error).status === 409` のように確認する。

## アプリ全体の集約ポイント

`createApiClient` 経由の通信だけが対象（独自に axios を呼ぶクライアントサービスには効かない）。

- `setApiErrorHandler(handler)`（`src/lib/crud/client/apiClientFactory.ts`）: 失敗したリクエストの `HttpError` を 1 か所で受け取る。既定は status 500 以上を `console.error` するだけ。監視サービスへの送信などに差し替える
- `registerCrudEventHandler(handler)`（`src/lib/crud/client/events.ts`）: CRUD 操作ごとに `{ action, success, error? }` が届く。計測・リトライ指示など UI 以外の集約に使う
