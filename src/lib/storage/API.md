# `src/lib/storage` API

## Overview

- `src/lib/storage` の関数・型・ルートの形。使い方と約束は [README.md](./README.md)、仕組みは [Internals.md](./Internals.md)

## API

### ref（業務行に保存する値）

```
storage://<pub|priv>/<purposeId>/<ledgerId>.<ext>
```

- `pub` = 公開バケット、`priv` = 非公開バケット。ref に出る保存先はこの 2 つだけ
- `purposeId` = `<domain>.<field>`
  - 正規表現は `^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9_]*$`（例 `user.avatar` / `purchaseRequest.bankProof` / `coupon.image_url`）
  - ref とオブジェクトのパスに入る
- `ledgerId` = 台帳の行 ID（uuidv7）
- `ext` = サーバーが Content-Type から決める拡張子。対応表に無い型は `bin`
- オブジェクトキー = `objectKeyOf(ref)` = `<purposeId>/<ledgerId>.<ext>`。実際のパスは、保存先の prefix を前に付けたもの
- 列の DDL は変えない。既存の text 列にそのまま入る
- ref が指す物が確定するのは commit の完了時。発行の応答の ref は予定の値（strip の画像は、その時点では受け取り領域にあり、ref の位置にはまだ何も無い）。

| 関数 | 用途 |
|---|---|
| `formatStorageRef(parts)` | 部品から ref を作る。形式違いは throw |
| `parseStorageRef(value)` | ref を部品に分ける。形式違い・未知の store は null |
| `isStorageRef(value)` | ref かどうか |
| `objectKeyOf(ref)` | オブジェクトキー |
| `isValidStoragePurposeId(id)` | 用途 ID の形式 |

### 表示: `resolveStorageSrc(value)`

保存値を表示用の URL にする純関数。例外は投げない。公開 URL を組み立てる唯一の場所。

| 値 | 結果 |
|---|---|
| null・空 | null |
| `storage://pub/...` | 公開 base（設定の `publicBaseUrl()`、上流は `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL`）+ `/` + オブジェクトキー（未設定なら null） |
| `storage://priv/...` | `/api/storage/objects/<ledgerId>`（都度認可して短期署名 URL へ 302 する固定 URL） |
| `http(s)://...`・`/` で始まる値 | そのまま（凍結した旧 URL・静的ファイル） |
| 解析できない `storage://`・それ以外 | null（未知の store を既定バケットに読み替えない） |

- `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` は、オブジェクトキーの直前までを指す
  - `STORAGE_PUBLIC_PREFIX` を使うなら、それも含める
  - 例 `https://storage.googleapis.com/<公開バケット>`
- 公開 base はアプリの cookie を持たない別ドメイン（GCS 直配信）にする。アプリと同じ origin の base は推奨しない
- `publicStorageHosts()` は公開 base のホストを返す。CORS 診断の表示に使う
- next/image の許可は `isPublicStorageUrl(src)`（公開 base + `/` の前方一致）で判定する
  - `storage.googleapis.com` のようにホストが共有のとき、ホストだけで許可すると他のバケットの URL まで最適化に通ってしまうため
  - `next.config.ts` の remotePatterns も同じ base のパス配下に限る

### 非公開の動画・音声: `usePrivateMediaRecovery(src, mediaRef)`

`@/lib/storage` の client hook。固定 URL（`/api/storage/objects/<id>`）の動画・音声が署名期限後に読めなくなったときの読み直しを持つ（仕組み: [Internals.md](./Internals.md)）。

- `videoProps`: 要素（`<video>` / `<audio>`）に `{...videoProps}` で広げる `src` と 6 つのイベント（`onError` / `onLoadedMetadata` / `onCanPlay` / `onLoadStart` / `onPlay` / `onSeeking`）。同じ src の間は同じ参照。型 `PrivateMediaVideoProps`
- `status`: `"idle"` / `"recovering"` / `"failed"`。`"failed"` ならエラーと再開の操作を出し、`resume()` を呼ぶ
- `src` と `handleError` / `handleLoadedMetadata` / `handleCanPlay` / `handleLoadStart` / `handlePlaybackIntent`: `videoProps` と同じ処理を 1 つずつ。包んで使うとき（`handleError` の真偽でエラー表示を決めるなど）だけ使う
- src が固定 URL でなければ何もしない（`videoProps` を広げても普通の要素と同じ）

### 配信規則（inline / attachment）

受け付けてよい型（用途の `contentTypes`）と、ブラウザに inline 表示させてよい型は分けて扱う。

- inline にするのは `INLINE_CONTENT_TYPES` の固定表だけ
  - 載っているのは画像（jpeg / png / gif / webp / avif）・動画・音声
- 次のものはすべて `Content-Disposition: attachment` にする
  - **HTML・SVG・XML などの文書型**
  - 表に無い一般ファイル
  - 不正な型
- keep の用途で `image/svg+xml` を受け付けても、SVG は attachment で配信される（strip の用途はそもそも SVG を受け付けない）
- `contentDispositionFor(contentType)` を、公開・非公開の両方に使う
  - 公開ファイル: オブジェクトの metadata。ポートの issuePut / issueSession / put / copy が自動で付ける
  - 非公開ファイル: 署名 URL の応答指定（`signRead` の `responseDisposition`）。省略時は attachment
- 型の照合（`matchesContentType`）は完全一致と `type/*`。比較の前に小文字化し、パラメータを外す

### エンジンの境界: `StoragePort`

`getStoragePort()` は GCS 実装を返す（初回の呼び出しで作る）。テストでは `__setStoragePortForTest(createFakeStoragePort())` で差し替える。エンジンの登録の仕組みや能力表は作らない（実装は GCS の 1 つ）。

| メソッド | 内容 |
|---|---|
| `issuePut(loc, { contentType, size, maxBytes, ttlSec })` | 単発 PUT の署名 URL と、ブラウザが付けるヘッダー |
| `issueSession(loc, { contentType, size, origin })` | GCS の再開可能セッション URI（URI 自体がアップロード権） |
| `cancelSession(sessionUrl)` | 再開可能セッションを中止する（アップロード権を殺す） |
| `head(loc)` | size・contentType・generation。無ければ null |
| `setCacheControl(loc, generation, value)` | 指定した世代の Cache-Control を書き換える |
| `read(loc, { maxBytes, generation? })` | 中身をサーバーに読み込む。`maxBytes` を超える物は読み込む前に `StorageReadTooLargeError`。無い・指定の世代が無ければ失敗 |
| `put(loc, body, { contentType, cacheControl })` | サーバーから書き込む |
| `copy(src, dst, { cacheControl, sourceGeneration? })` | 複製する（rewrite を完了まで回す） |
| `delete(loc, { generation? })` | 削除する。無い・別の世代に置き換わっている場合は何もしない |
| `signRead(loc, { ttlSec, generation?, responseDisposition? })` | 読み取り用の短期署名 URL |

実装の約束:

- **書き込み先は上書き不可**（`ifGenerationMatch: 0`）。issuePut / issueSession / put / copy のすべてに適用
- **発行時の Cache-Control は `no-store` 固定**（`ISSUED_CACHE_CONTROL`。呼び出し側からは指定させない）
  - 公開ファイルは commit の照合後に `setCacheControl` で、その generation だけを長期 cache にする
  - 非公開ファイルは常に no-store
- generation を受ける操作は、指定があればその世代だけを対象にする（照合した世代と違う中身を配らない・読まない・消さない）
- Content-Disposition は「配信規則」のとおり実装が付ける
- 認可はしない。呼び出し側（features/core/storageObject）が判定してから使う
- strip の描き直しは、専用のメソッドを持たず read（原本を読む）→ put（本来の位置に書く）→ delete（原本を消す）で行う
- StoragePort を自前で実装する場合は read も実装する（fake は同梱）

### 保存先（store）と env

値は上書き `src/config/lib/storage.config.ts` の `stores.<store>` の関数(`bucket` / `prefix`)から、`isStorageStoreConfigured`・`getStoreConfig`・`locationOf` が呼ぶたびに読む。下の env はその上流の上書きが読む名前(未設定の誤りの文もこの名前を出す)。

| store | env | 用途 |
|---|---|---|
| `pub` | `STORAGE_PUBLIC_BUCKET`（必須）/ `STORAGE_PUBLIC_PREFIX`（任意） | 公開バケット（均一なバケットレベルのアクセス = UBLA、allUsers に get のみ） |
| `priv` | `STORAGE_PRIVATE_BUCKET`（必須）/ `STORAGE_PRIVATE_PREFIX`（任意） | 非公開バケット（UBLA、公開アクセス防止）。strip の画像の受け取り領域（`incoming/`）もここ |
| `legacy` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 旧バケット。ref には出ない。サーバー内部で旧 URL の解析・削除・コピーにだけ使う |

- `locationOf(store, objectKey)` で物理位置（`{ bucket, path }`）を得る
- pub / priv の env が無ければ `StorageNotConfiguredError` ですぐに失敗する
  - strip の画像は公開の用途でも priv で受け取るので、`STORAGE_PRIVATE_BUCKET` が無いと公開の用途の画像の発行も失敗する
- 旧バケットには新しいファイルを置かない（配備の順序によっては旧バケットに緩いルールが残っている期間がある）
- 新しい 2 つのバケットは Firebase に登録しない（クライアント SDK からの経路を作らない）
- バケットの作成・権限・CORS は `pnpm ops storage setup` で行う（priv の CORS は受け取り領域へのアップロードにも使われる）。手順・必要な権限・組織のポリシーで止まる場合・location の注意: [scripts/operations/storage/README.md](../../../scripts/operations/storage/README.md)

### 旧 URL: `server/legacy.ts`

- 既存のメディア（旧 URL）は公開のまま凍結する。新しい API は旧 URL を受け付けない
- `parseLegacyStorageUrl(url)` は、自分の旧バケットの URL を位置に変換する
  - 対象は Firebase のトークン付きダウンロード URL と、`storage.googleapis.com/<bucket>/...`
  - 外部 URL・他バケットの URL・旧バケットが未設定なら null
  - pub / priv の保存先と重なる位置（同じバケットで prefix 配下）も null。管理下の物を旧 URL として copy・削除・probe させないため。`isLegacyLocation(location)` が同じ判定
  - 旧バケットを pub / priv と共有し prefix が `""` の構成では、旧バケットのどの URL も旧 URL として扱われない（旧物の copy・削除連動・probe ができない。安全側）
- 使う所
  - 業務行の物理削除に連動する削除
  - 管理者による複製（copy で新しい ref にする。宛先が strip の用途の画像なら描き直す）
  - 管理者のメディア解析（`/api/media/probe` の storagePath / downloadUrl）

### 用途（purpose）の型: `policy/types.ts`

```ts
type StoragePurpose = {
  visibility: "public" | "private";
  maxBytes: number;
  contentTypes: readonly string[];   // "image/png" | "image/*"
  upload: { allow; check? };         // 必須。allow は DomainApiAccessRule（"public" 以外）
  read?: { allow; check? };          // private では必須
  delete?: { allow; check? };        // 省略 = HTTP では削除できない
  maxPending?: number;               // 省略 = storageObjectConfig.defaultMaxPending
  attach?: false;                    // false = 業務行に紐付けない（チャット添付）
  metadata?: "strip" | "keep";       // 画像のメタデータの扱い。省略 = strip（「位置情報の約束」）
  image?: { maxDimension: number; quality?: number }; // 画像の縮小の指定。省略 = 縮めない（下の「画像の縮小の指定」）
};
```

- allow（既存の DomainApiAccessRule の語彙）と check（任意の判定関数）は AND。暗黙に判定を通る道（admin・system の素通し）は無い
- `resolveStoragePurpose(map, id)` は、未登録なら `StoragePurposeNotFoundError`（400）を投げる。`findStoragePurpose(map, id)` は未登録で undefined
- `listStoragePurposeProblems(map)` は用途表の形式を検査する（metadata の値・描き直せない画像の型・画像の無い用途の strip・`user.avatar` の keep・`image` の形と keep / 画像の無い用途への指定を含む）。用途の登録表との結線は `src/features/core/storageObject/services/server/purposeSource.ts` で行う

### 用途の方針: `GET /api/storage/purposes/[purpose]`

- 応答 `{ metadata: "strip" | "keep", image: { maxDimension, quality? } | null }`（`storageObjectService.describePurpose`。`user.avatar` は常に strip。`image` は用途の縮小の指定、無ければ null）
- ログイン必須（createApiRoute `authenticated`）。未登録・ID の形式違いは 404。誰が聞いても同じ答えなので `/api/me/` には置かない
- `Cache-Control: private, max-age=300`
- クライアントは `purposeMetadataLoader`（`purposePolicy.ts`）が用途ごとに記憶する（ページの寿命の間。同時の呼び出しはまとめる。失敗は記憶せず次で取り直す）。`load` / `peek` は metadata、`loadPolicy` / `peekPolicy` は方針の全体（metadata と image）。`uploadToStorage`・`usePurposeMetadata`・`shrinkImageForPurpose` が同じ記憶を共有する
- strip で受け付ける画像の型は、サーバーと同じ共有定数 `STRIP_IMAGE_TYPES`（client-safe）を端末が使う。応答には含めない
- route を列挙・制限している仕組み（独自の proxy・WAF など）では、このパスを通す

### メディア列のスキーマ: `storageMediaValueSchema`

- ref か http(s) の URL を受ける(`z.string().url()` は `storage://` も通してしまう)
- 空を許す列は `.nullish()`、複数値の列は `z.array(storageMediaValueSchema)`
- http(s) の値を新しい行に書いてよいかは、スキーマではなく CRUD 連動の側で判定する
