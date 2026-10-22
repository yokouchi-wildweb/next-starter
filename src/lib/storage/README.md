# `src/lib/storage`

ファイル保存の基盤。判定するのはアプリのサーバーだけで、ファイル本体はブラウザから GCS へ直接送る。どのファイルが何に使われているかは、台帳（core ドメイン `storageObject`）で管理する。

この lib が持つのは、エンジンに依存しない部品だけ。

- ファイル参照（ref）の形式と表示用 URL への解決
- 配信規則（inline / attachment）
- エンジンの境界（StoragePort）と GCS 実装
- 保存先（store）の解決
- 用途（purpose）の型

誰がアップロード・読み取り・削除してよいかの判定と台帳は、`src/features/core/storageObject` が持つ。この lib は features に依存しない。

> **移行中**: 新しい基盤（この README の大半）は追加の段階（N1 `storage-foundation`）。旧 API（`client/` の 3 ファイル・`hooks/`・`server/storageService.ts`・`server/wrappers/`・`types.ts`）はまだ動いており、N2 `storage-cutover` で削除する。新しいコードは旧 API を使わない。旧 API の注意点は末尾の「旧 API」を参照。

## 全体の流れ

1. 用途を登録する（`src/registry/storagePurposeRegistry.ts`。未登録の用途は拒否）
2. サーバーがアップロード権を発行する。台帳に pending の行を作り、上書き不可の署名 PUT か GCS の再開可能セッションを返す
3. ブラウザが GCS へ直接送る
4. commit: サーバーが HEAD で size・申告 MIME・generation を照合し、ready にする。**照合するのはこの 3 つだけで、ファイルの中身は検査しない**
5. 業務行の列に `storage://` の ref を保存する。台帳との紐付けは業務保存と同じトランザクションで行う
6. 業務行の物理削除に連動して実物を削除する。紐付かなかったものは掃除 cron が消す

このうち 2・4・5・6 は features/core/storageObject と createCrudService の `storage` オプションの役目。この lib はその部品を提供する。

## 構成

| ファイル | 実行環境 | 役割 |
|---|---|---|
| `index.ts` | client-safe | 入口（ref・配信規則・スキーマ・用途の型） |
| `ref.ts` | client-safe | ref の組み立て・解析、`resolveStorageSrc`、`publicStorageHosts` |
| `contentTypes.ts` | client-safe | 型の照合、拡張子の対応表、inline / attachment の判定 |
| `schema.ts` | client-safe | メディア列の値の zod スキーマ `storageMediaValueSchema` |
| `policy/types.ts` | client-safe | 用途の型 `StoragePurpose` ほか |
| `server/index.ts` | server | サーバー専用の入口 |
| `server/port.ts` | server | `StoragePort`（エンジンの境界）と `getStoragePort()` |
| `server/gcs.ts` | server | GCS 実装（Firebase Admin の `getServerStorage()` 経由） |
| `server/fake.ts` | server（テスト） | メモリ上の実装と `__setStoragePortForTest` |
| `server/stores.ts` | server | 保存先 → バケット・prefix の解決、`StorageNotConfiguredError` |
| `server/purposes.ts` | server | 用途表からの引き当て、形式の検査 |
| `server/legacy.ts` | server | 旧バケットの旧 URL → 位置の変換 |

## ref（業務行に保存する値）

```
storage://<pub|priv>/<purposeId>/<ledgerId>.<ext>
```

- `pub` = 公開バケット、`priv` = 非公開バケット。ref に出る保存先はこの 2 つだけ
- `purposeId` = `<domain>.<field>`
  - 正規表現は `^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9_]*$`（例 `user.avatar` / `purchaseRequest.bankProof` / `coupon.image_url`）
  - **改名できない**。ref とオブジェクトのパスに入るため
- `ledgerId` = 台帳の行 ID（uuidv7）
- `ext` = サーバーが Content-Type から決める拡張子。対応表に無い型は `bin`
- オブジェクトキー = `objectKeyOf(ref)` = `<purposeId>/<ledgerId>.<ext>`。実際のパスは、保存先の prefix を前に付けたもの
- 列の DDL は変えない。既存の text 列にそのまま入る

| 関数 | 用途 |
|---|---|
| `formatStorageRef(parts)` | 部品から ref を作る。形式違いは throw |
| `parseStorageRef(value)` | ref を部品に分ける。形式違い・未知の store は null |
| `isStorageRef(value)` | ref かどうか |
| `objectKeyOf(ref)` | オブジェクトキー |
| `isValidStoragePurposeId(id)` | 用途 ID の形式 |

## 表示: `resolveStorageSrc(value)`

保存値を表示用の URL にする純関数。例外は投げない。**公開 URL を組み立てるのはここだけ**で、ほかの場所にバケットのホストを書かない。

| 値 | 結果 |
|---|---|
| null・空 | null |
| `storage://pub/...` | `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` + `/` + オブジェクトキー（env が未設定なら null） |
| `storage://priv/...` | `/api/storage/objects/<ledgerId>`（都度認可して短期署名 URL へ 302 する固定 URL） |
| `http(s)://...`・`/` で始まる値 | そのまま（凍結した旧 URL・静的ファイル） |
| 解析できない `storage://`・それ以外 | null（未知の store を既定バケットに読み替えない） |

- `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` は、オブジェクトキーの直前までを指す
  - `STORAGE_PUBLIC_PREFIX` を使うなら、それも含める
  - 例 `https://storage.googleapis.com/<公開バケット>`
- 公開 base はアプリの cookie を持たない別ドメイン（GCS 直配信）にする。アプリと同じ origin の base は推奨しない
- `publicStorageHosts()` は公開 base のホストを返す。next/image の許可と CORS 診断の判定に使う

## 配信規則（inline / attachment）

受け付けてよい型（用途の `contentTypes`）と、ブラウザに inline 表示させてよい型は分けて扱う。

- inline にするのは `INLINE_CONTENT_TYPES` の固定表だけ
  - 載っているのは画像（jpeg / png / gif / webp / avif）・動画・音声
  - 下流から追加する口は無い
- 次のものはすべて `Content-Disposition: attachment` にする
  - **HTML・SVG・XML などの文書型**
  - 表に無い一般ファイル
  - 不正な型
- 用途で `image/*` を受け付けても、SVG は attachment で配信される
- `contentDispositionFor(contentType)` を、公開・非公開の両方に使う
  - 公開ファイル: オブジェクトの metadata。ポートの issuePut / issueSession / put / copy が自動で付ける
  - 非公開ファイル: 署名 URL の応答指定（`signRead` の `responseDisposition`）。省略時は attachment
- 型の照合（`matchesContentType`）は完全一致と `type/*`。比較の前に小文字化し、パラメータを外す

## エンジンの境界: `StoragePort`

`getStoragePort()` は GCS 実装を返す（初回の呼び出しで作る）。テストでは `__setStoragePortForTest(createFakeStoragePort())` で差し替える。エンジンの登録の仕組みや能力表は作らない（実装は GCS の 1 つ）。

| メソッド | 内容 |
|---|---|
| `issuePut(loc, { contentType, size, maxBytes, ttlSec })` | 単発 PUT の署名 URL と、ブラウザが付けるヘッダー |
| `issueSession(loc, { contentType, size, origin })` | GCS の再開可能セッション URI（URI 自体がアップロード権） |
| `head(loc)` | size・contentType・generation。無ければ null |
| `setCacheControl(loc, generation, value)` | 指定した世代の Cache-Control を書き換える |
| `put(loc, body, { contentType, cacheControl })` | サーバーから書き込む |
| `copy(src, dst, { cacheControl, sourceGeneration? })` | 複製する（rewrite を完了まで回す） |
| `delete(loc, { generation? })` | 削除する。無い・別の世代に置き換わっている場合は何もしない |
| `signRead(loc, { ttlSec, generation?, responseDisposition? })` | 読み取り用の短期署名 URL |

実装が守る約束:

- **書き込み先は上書き不可**（`ifGenerationMatch: 0`）。issuePut / issueSession / put / copy のすべてに適用
- **発行時の Cache-Control は `no-store` 固定**（`ISSUED_CACHE_CONTROL`。呼び出し側からは指定させない）
  - 公開ファイルは commit の照合後に `setCacheControl` で、その generation だけを長期 cache にする
  - 非公開ファイルは常に no-store
- generation を受ける操作は、指定があればその世代だけを対象にする（照合した世代と違う中身を配らない・消さない）
- Content-Disposition は「配信規則」のとおり実装が付ける
- 認可はしない。呼び出し側（features/core/storageObject）が判定してから使う

## 保存先（store）と env

| store | env | 用途 |
|---|---|---|
| `pub` | `STORAGE_PUBLIC_BUCKET`（必須）/ `STORAGE_PUBLIC_PREFIX`（任意） | 公開バケット（UBLA、allUsers に get のみ） |
| `priv` | `STORAGE_PRIVATE_BUCKET`（必須）/ `STORAGE_PRIVATE_PREFIX`（任意） | 非公開バケット（UBLA、公開アクセス防止） |
| `legacy` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 旧バケット。ref には出ない。サーバー内部で旧 URL の解析・削除・コピーにだけ使う |

- `locationOf(store, objectKey)` で物理位置（`{ bucket, path }`）を得る
- pub / priv の env が無ければ `StorageNotConfiguredError` ですぐに失敗する
- **既定バケットへの読み替え（暗黙の fallback）はしない**。旧バケットには移行期間中も緩いルールが残るので、新しいファイルを置かない
- 新しい 2 つのバケットは Firebase に登録しない（クライアント SDK からの経路を作らない）
- バケットの作成・権限・CORS の手順は、N1 の出荷時に docs/setup と `pnpm storage:setup` で用意する

## 旧 URL: `server/legacy.ts`

- 既存のメディア（旧 URL）は公開のまま凍結する。新しい API は旧 URL を受け付けない
- `parseLegacyStorageUrl(url)` は、自分の旧バケットの URL を位置に変換する
  - 対象は Firebase のトークン付きダウンロード URL と、`storage.googleapis.com/<bucket>/...`
  - 外部 URL・他バケットの URL・旧バケットが未設定なら null
- 使ってよいのは次の 2 つだけ
  - 業務行の物理削除に連動する削除
  - 管理者による複製（copy で新しい ref にする）
- 利用者による旧ファイルの個別削除・上書きには使わない

## 用途（purpose）の型: `policy/types.ts`

```ts
type StoragePurpose = {
  visibility: "public" | "private";
  maxBytes: number;
  contentTypes: readonly string[];   // "image/png" | "image/*"
  upload: { allow; check? };         // 必須。allow は DomainApiAccessRule（"public" 以外）
  read?: { allow; check? };          // private では必須
  delete?: { allow; check? };        // 省略 = HTTP では削除できない
  maxPending?: number;               // 省略 = storage.config の defaultMaxPending
  attach?: false;                    // false = 業務行に紐付けない（チャット添付）
};
```

- allow（既存の DomainApiAccessRule の語彙）と check（任意の判定関数）は AND。暗黙に判定を通る道（admin・system の素通し）は無い
- `resolveStoragePurpose(map, id)` は、未登録なら `StoragePurposeNotFoundError`（400）を投げる
- `listStoragePurposeProblems(map)` は用途表の形式を検査する。用途の登録表との結線は `src/registry/storagePurposeRegistry.ts` で行う

## メディア列のスキーマ: `storageMediaValueSchema`

- ref か http(s) の URL を受ける。`z.string().url()` は `storage://` も通してしまうので、メディア列にはこちらを使う
- 空を許す列は `.nullish()`、複数値の列は `z.array(storageMediaValueSchema)`
- http(s) の値を新しい行に書いてよいかは、スキーマではなく CRUD 連動の側で判定する

## 運用値: `src/config/app/storage.config.ts`

- 読み取り署名の TTL: 画像・ファイル 300 秒 / 動画・音声 900 秒 / probe 120 秒
- 発行期限: PUT 15 分 / セッション 24 時間
  - GCS のセッション URI 自体は約 1 週間生きるので、中止・期限切れではサーバーが URI を DELETE する
- 未採用の猶予 24 時間 / maxPending の既定 20 / セッションに切り替える閾値 16MiB
- `defaultMaxBytesByPreset`（maxSizeBytes の無いメディア項目の既定）/ 掃除 cron の予算
- アップロード権の発行のレート制限は `rate-limit.config.ts` の `storageIssue`

## 未設定のとき（UNCONFIGURED_BACKENDS）

- `resolveStorageSrc` は例外を投げない（公開 base が無ければ pub の ref に null）
- ポートの構築、各モジュールの import は env が空でも落ちない
- 操作した時点で、次のエラーがすぐに出る
  - pub / priv の env 不足は `StorageNotConfiguredError`
  - Firebase Admin の未設定は `FirebaseNotConfiguredError`

## 暫定の点（スパイク S2 / S3 の結果で確定）

実機での確認が済むまで、次の 2 点は暫定の実装になっている。確認の結果、成り立たないことが分かった場合は、単発 PUT の経路を外してセッションに一本化する（評議会の計画どおり）。

- `issuePut` の署名ヘッダーの組
  - `x-goog-if-generation-match: 0` と `x-goog-content-length-range: 0,<maxBytes>` を署名に含める
  - Content-Type・Cache-Control・Content-Disposition もヘッダーとして署名に含める
  - 確認すること: 上書き不可とサイズ上限が GCS 側で強制されるか
- `issueSession` の開始条件
  - `ifGenerationMatch: 0`・Origin・`contentLength` の宣言
  - 確認すること: 上書き不可と、宣言と違うサイズがどう扱われるか

## テスト

`pnpm test:storage-ref` で次を確かめる。

- ref と resolve の純関数
- inline / attachment の判定（HTML・SVG・画像・一般ファイル）
- メディア列のスキーマ
- fake ポート（上書き不可・世代指定・発行時 no-store）
- 未設定のときの挙動
- 旧 URL の解析
- 用途の引き当て

## 旧 API（N2 で削除）

- 対象: `client/{appStorageClient,clientUploader,directStorageClient}.ts`、`hooks/`、`server/storageService.ts`、`server/wrappers/`、`types.ts`
- 旧 API の権限
  - `/api/storage/upload`・`/api/storage/delete`（`useAppStorage` / `appStorageClient`）は、保存先・所有者の検証を持たないため、管理者カテゴリのみに制限している（未ログイン 401 / 一般ユーザー 403）
  - クライアント直経路（`clientUploader` / `directStorageClient` / `useDirectStorage`）の権限は Firebase Storage ルールだけが判定する。`request.auth != null` だけでは、ログインユーザーなら誰でも任意のファイルを上書き・削除できるので、各環境で書き込み先のパスを絞ること
- 新しい画面・ドメインはこれらを使わない。切替の手順は N2 の notice で出す
