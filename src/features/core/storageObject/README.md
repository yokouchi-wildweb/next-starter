# storageObject（ファイル台帳）

アップロードされたファイルを 1 行ずつ記録する core ドメインです。この台帳が受け持つのは次の 5 つです。

- アップロード権の発行
- commit（照合）
- 取り消し
- 非公開ファイルの読み取り（都度認可）
- 業務行への紐付けと解除

ファイル本体はブラウザから GCS へ直接送ります。誰が何をしてよいかは、アプリのサーバーだけが判定します。部品（ref・ポート・配信規則・保存先）は [`src/lib/storage`](../../../lib/storage/README.md) にあり、このドメインはそれを使って判定と記録を行います。

> 用途は登録表 `src/registry/storagePurposeRegistry.ts`（`getStoragePurposes()` が返す）、業務行との連動は createCrudService の `storage` オプション（`storageBindingFor`、[src/lib/crud/README.md](../../../lib/crud/README.md)「storage オプション」）、掃除は cron `storage-sweep`。クライアントは `uploadToStorage`（[src/lib/storage/README.md](../../../lib/storage/README.md)）。

## 流れ

```
issue（pending）→ ブラウザが GCS へ直接送る → commit（ready）→ 業務保存と同じ TX で attach
                                                      └→ 値の置換・業務行の物理削除で detach（deleted）→ TX の後で実物を削除
```

| 操作 | 入口 | 内容 |
|---|---|---|
| issue | `POST /api/me/storage/uploads`（createMeRoute、rateLimit `storageIssue`） | 用途の upload 規則で判定し、pending の行と、上書き不可のアップロード権を作る |
| commit | `POST /api/me/storage/uploads/[id]/commit` | HEAD で **size・申告 MIME・generation を照合して** ready にする |
| discard | `DELETE /api/me/storage/uploads/[id]` | 本人の未採用ファイル（pending、または紐付いていない ready）を取り消す |
| read | `GET /api/storage/objects/[id]`（createApiRoute `"public"`） | 用途の read 規則を都度判定し、照合済みの世代の短期署名 URL へ 302 する |
| remove | `DELETE /api/storage/objects/[id]`（createApiRoute `"authenticated"`） | 用途に delete 規則がある、紐付いていないファイルだけを削除する |
| putFromServer / copy | サーバー内（`storageObjectService`） | サーバーから書き込む・複製する。いきなり ready の行を作る |
| attach / detach | サーバー内（業務保存の TX の中） | 業務行に紐付ける・紐付けを外す。HTTP には出さない |

commit は**ファイルの中身を検査しません**。照合するのは size・申告 MIME・generation の 3 つだけです。ブラウザに inline 表示させるかどうかは、lib/storage の配信規則が決めます（画像・動画・音声の固定表に載っている型だけが inline）。

## 規則（fail-closed）

- **用途**
  - 未登録の用途は 400
  - allow（DomainApiAccessRule）と check（判定関数）は AND。admin・system の暗黙の素通しは無い
  - check の無い用途に scopeId を指定したら 400
- **発行**
  - 次のものは 400 にする
    - 型が用途の contentTypes に合わない
    - サイズが 1 未満、または用途の maxBytes を超える（ちょうど maxBytes は通る）
    - 入力に未知のキーがある（保存先のキー・所有者は利用者が指定できない）
  - 判定で拒否したら 403。行もアップロード権も作らない
  - 未完了数が `maxPending`（用途の値、無ければ `storage.config` の `defaultMaxPending`）に達していたら 429
    - 数える対象は、同じ利用者・同じ用途の次の 2 つ
      - pending の行
      - deleted だが実物の削除が済んでおらず、期限内の行
    - 数える前に、同じ lock の中で、その利用者・用途の期限切れの put pending を deleted（reason `expired`、`object_removed_at` null）にする。期限後の署名 URL は使えないので枠を返してよい（実物は掃除が消す）
    - 期限切れの session pending は、cloud 側で URI がまだ生きているので、掃除が URI を中止するまで数え続ける
    - 数え上げと INSERT は、利用者 × 用途ごとの advisory lock（`pg_advisory_xact_lock`）を取った TX の中で行う。並行して発行しても上限を超えない
  - `sessionThresholdBytes`（16MiB）を超えるファイルは、単発 PUT ではなく GCS の再開可能セッションで送る
- **commit**
  - 他人の ID・存在しない ID は 404
  - 期限切れは 410 で deleted（reason `expired`）
  - まだ送られていなければ 409 で、pending のまま残す
  - size・型が申告と違えば 422 で deleted（reason `size_mismatch` / `type_mismatch`）にし、その世代を消す
  - 公開の用途は、照合した世代に `public, max-age=31536000, immutable` を付けてから ready にする。非公開は常に `no-store`
  - 再送・並行実行には同じ ref を返す。ready の後に新しいアップロード権は返さない
- **discard**
  - 本人の、紐付いていない pending / ready だけを取り消せる（他人は 404、紐付け済みは 409）
  - 取り消し済みの再送は成功（`{ ok: true }`）
- **読み取り**（`GET /api/storage/objects/[id]`）
  - ready の非公開ファイルで、用途に read があるものだけを対象にする
  - ログインが要る用途で未ログインなら 401、それ以外の失敗は 404
  - 302 と失敗応答には `Cache-Control: private, no-store` と `Vary: Cookie, Authorization` を付ける
  - 失敗応答には Location を付けない。判定中の例外（DB・判定先の障害）は 500 で、署名 URL は返さない
  - TTL はファイルの種類で決める（画像・ファイル 300 秒 / 動画・音声 900 秒）
  - Content-Disposition は lib/storage の `contentDispositionFor` で決める
  - read が `"public"` の用途では、セッションを引かない
- **attach**
  - 次のすべてを満たすときだけ紐付く
    - 行が ready で、まだ紐付いていない
    - ref の purpose / store / key が行と一致する（改変した ref は通らない）
    - 保存する利用者が、アップロードした本人である
    - scopeId を指定した場合は、それも一致する
  - 満たさなければ DomainError 400 を投げ、業務の TX ごと巻き戻す
- **detach**: 業務行に紐付いた ready を deleted（reason `replaced` / `record_removed`）にする。実物は TX の commit 後に `cleanupDeletedObject` で消す
- **rebind**: 業務行に紐付いた ready の紐付け先を、同じ種類の別の業務行へ移す（replaceByQuery で新しい行に残る ref）
  - 行が ready で、ref の purpose が一致し、いまの紐付け先が移す元の行のときだけ成功する（scopeId を指定した場合はそれも一致）
  - 満たさなければ DomainError 400 を投げ、業務の TX ごと巻き戻す
- **FK cascade**: メディア列を持つ表の行を DB の cascade で消すと、detach されずに紐付けが残り、実物も残る。cascade は許す（台帳との照合で片付ける仕組みを後で入れる予定）。すぐ片付けたい表は restrict にし、子のサービスで消す（任意。[lib/crud README「storage オプション」](../../../lib/crud/README.md)）
- **サーバー内の書き込み**: putFromServer / copy の所有者は呼び出し側が渡す
  - cron・system の書き込みは `null`
  - 利用者・管理者が起点なら、実際の利用者
  - copy は、複製元が無い・外部 URL なら throw する（黙って null にしない）
- **ユーザーの物理削除**: 何も起動しない。台帳の行も実物も残る（初版の決定。LATER）

## 実物の削除（`cleanupDeletedObject`）

- 再開可能セッションの行は、先に session URI を DELETE してアップロード権を殺す（`StoragePort.cancelSession`）。そのうえで実物を消し、`object_removed_at` を埋める
- 単発 PUT の署名 URL は取り消せない
  - 期限内に消しても、期限前に再送されると実物が復活しうる
  - そのため、期限内は `object_removed_at` を埋めずに枠も保持する。期限後にもう一度消して完了にする（掃除 cron の役目）
- 失敗はログだけ残して握りつぶす。`deleted` で `object_removed_at` が null の行は、掃除 cron が拾う

## 掃除（cron `storage-sweep`）

`src/app/api/cron/storage-sweep/` → `services/server/sweep.ts`（`runStorageSweep`）。`runBudgetedBatches` + `createDeadline(STORAGE_CONFIG.sweep.budgetMs)` で、次の 3 種類を id 順に片付ける。

| 種類 | 対象 | 処理 |
|---|---|---|
| expiredPending | 期限切れの pending | deleted（reason `expired`）にしてから実物を片付ける。session は URI を中止してから削除、put は期限後なのでそのまま完了 |
| unattachedReady | 業務行に紐付かないまま `unattachedGraceSec`（既定 24h）を過ぎた ready | deleted（reason `expired`）にして削除。`attach: false` の用途（チャット添付）は対象外。duplicate の失敗で残った複製もここで回収される |
| pendingRemoval | deleted で `object_removed_at` が null の行 | 実物の削除を再試行する。put は期限後だけ（期限内の署名 URL で再送されうるため）、session はいつでも |

- 紐付いた行と旧 URL（台帳に無い）は対象にならない
- 物理削除の前に条件付き UPDATE で採用できない状態にする。掃除の取得と削除の間に attach が成功しても、採用された物は消えない
- GCS の 404 は成功扱い。重ねて・並行に実行しても、時間予算で途中終了しても安全（次回に続きを拾う）
- schedule は毎時。`pnpm cron:generate --plan hobby` では 1 日 1 回になる
- **アップロード権はアプリの期限後も cloud 側でしばらく生きうる**
  - session URI は約 1 週間
  - 単発 PUT の署名 URL は期限まで、削除後の同じ key への再送も通る（実機で確認）
  - 「期限直後に必ず消える」とは説明しない。Hobby の掃除は 1 日 1 回

## 台帳 `storage_objects`

- **列**
  - 識別: id（uuidv7）/ purpose / status / store / key
  - 所有・範囲: owner_user_id（FK なし）/ scope_id
  - ファイルの情報: declared_size / size / content_type / generation
  - アップロード権: transfer_kind（put | session）/ session_uri
  - 紐付け: record_type / record_id / record_field
  - 時刻: expires_at / created_at / ready_at / deleted_at / object_removed_at
  - reason
- **session_uri は hiddenColumns**: 生の select では取り出さず、`services/server/finders/findStorageObjectById.ts` だけが読む
- **index はすべて素の列**（push の往復を守る）: unique(store, key) / (status, expires_at) / (owner_user_id, status) / (record_type, record_id) / (status, ready_at)
- **schemaRegistry**: CORE DOMAINS ブロックに登録済み。feature-gate の対象外
- **監査**: 初版は記録しない

## 構成

| ファイル | 役割 |
|---|---|
| `entities/drizzle.ts` / `entities/model.ts` | テーブルと型 |
| `services/server/storageObjectService.ts` | サービス本体。`createStorageObjectService(deps)` で、台帳・ポート・用途表・時刻・ID を差し替えられる |
| `services/server/policy.ts` | 用途の規則の判定（`evaluateApiAccessRule` + check）と、SessionUser → StorageActor の変換 |
| `services/server/purposeSource.ts` | 用途表の取得口（登録表ができるまでは空） |
| `services/server/http.ts` | ルートの入力の検証と、読み取りの応答 |
| `services/server/ledger/` | 台帳の読み書きの境界（`drizzleLedger` / テスト用 `memoryLedger`） |

## テスト

- `pnpm test:storage-object`: memoryLedger と fake ポートを使った単体テスト。読み取りルートのヘッダーのテストも含む
  - 往復: issue → commit → attach → detach → 掃除対象化
  - 発行・commit・取り消し・読み取りの受入項目
  - storage オプションの規則（`crudBinding.test.ts`）、掃除と期限切れ put pending の枠返却（`sweep.test.ts`）
- `pnpm test:storage-object-db`: 実 DB で、条件付き INSERT / UPDATE が並行実行でも一方だけ成功することを確かめる
  - 開発 DB に `test.*` の行を作り、終了時に消す
  - DATABASE_URL が無ければ skip する
  - 先に `pnpm db:push` が必要
