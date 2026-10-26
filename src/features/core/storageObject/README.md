# storageObject（ファイル台帳）

アップロードされたファイルを 1 行ずつ記録する core ドメインです。この台帳が受け持つのは次の 5 つです。

- アップロード権の発行
- commit（照合。strip の用途の画像は、受け取り領域からの描き直しと本来の位置への書き込み）
- 取り消し
- 非公開ファイルの読み取り（都度認可）
- 業務行への紐付けと解除

ファイル本体はブラウザから GCS へ直接送ります。誰が何をしてよいかは、アプリのサーバーだけが判定します。部品（ref・ポート・配信規則・保存先）は [`src/lib/storage`](../../../lib/storage/README.md) にあり、このドメインはそれを使って判定と記録を行います。

> 用途は登録表 `src/registry/storagePurposeRegistry.ts`（`getStoragePurposes()` が返す。`user.avatar` は strip に固定して返す）、業務行との連動は createCrudService の `storage` オプション（`storageBindingFor`、[src/lib/crud/README.md](../../../lib/crud/README.md)「storage オプション」）、掃除は cron `storage-sweep`。クライアントは `uploadToStorage`（[src/lib/storage/README.md](../../../lib/storage/README.md)）。

## 流れ

```
issue（pending）→ ブラウザが GCS へ直接送る → commit（ready）→ 業務保存と同じ TX で attach
                                                      └→ 値の置換・業務行の物理削除で detach（deleted）→ TX の後で実物を削除
```

strip の用途の画像（用途の `metadata` が strip または省略、かつ型が `image/*`。判定と保証の範囲は [lib/storage README「位置情報の約束」](../../../lib/storage/README.md)）は、送り先と commit が違う。

```
issue: 行は store=priv・key=incoming/<本来の store>/<purposeId>/<id>.<ext>（受け取り領域）、応答の ref は予定の最終 ref
  → ブラウザが受け取り領域へ直接送る
  → commit: HEAD で照合 → その世代を read → 描き直し（stripImageMetadata）→ 本来の位置へ create-only で put
            → 受け取り領域の原本を delete → ready（行の store / key を本来の位置へ書き換える）
```

- 受け取り領域は priv バケットの `incoming/` 接頭辞。別バケット・GCS のライフサイクル規則は使わない（受け取り中の物は必ず pending / deleted の行が追い、掃除 cron が消す）
- 用途 ID は必ず「.」を含むので、`incoming/` のキーと通常のキーは衝突しない
- 受け取り中かどうかは行のキーで判断する（キーから本来の位置を導く）。発行と commit の間に用途の metadata を変えても、発行時の判定に従う
- ref が指す物が確定するのは commit の完了時。発行の応答の ref は今までどおり返すが（wire 互換）、業務行に保存するのは commit の応答の ref

| 操作 | 入口 | 内容 |
|---|---|---|
| issue | `POST /api/me/storage/uploads`（createMeRoute、rateLimit `storageIssue`） | 用途の upload 規則で判定し、pending の行と、上書き不可のアップロード権を作る |
| commit | `POST /api/me/storage/uploads/[id]/commit` | HEAD で **size・申告 MIME・generation を照合して** ready にする。strip の画像は描き直して本来の位置へ書く |
| discard | `DELETE /api/me/storage/uploads/[id]` | 本人の未採用ファイル（pending、または紐付いていない ready）を取り消す |
| read | `GET /api/storage/objects/[id]`（createApiRoute `"public"`） | 用途の read 規則を都度判定し、照合済みの世代の短期署名 URL へ 302 する |
| remove | `DELETE /api/storage/objects/[id]`（createApiRoute `"authenticated"`） | 用途に delete 規則がある、紐付いていないファイルだけを削除する |
| policy | `GET /api/storage/purposes/[purpose]`（createApiRoute `"authenticated"`） | 用途の方針 `{ metadata }` を返す（`describePurpose`）。端末が HEIC などの変換と accept を決める |
| putFromServer / copy | サーバー内（`storageObjectService`） | サーバーから書き込む・複製する。いきなり ready の行を作る。宛先が strip の画像なら描き直す |
| attach / detach | サーバー内（業務保存の TX の中） | 業務行に紐付ける・紐付けを外す。HTTP には出さない |

keep の用途と画像以外の型では、commit は**ファイルの中身を検査しません**。照合するのは size・申告 MIME・generation の 3 つだけです。strip の画像は描き直しの時に、実際の形式が申告と同じかを sharp で確かめます。ブラウザに inline 表示させるかどうかは、lib/storage の配信規則が決めます（画像・動画・音声の固定表に載っている型だけが inline）。

## 規則（fail-closed）

- **用途**
  - 未登録の用途は 400
  - allow（DomainApiAccessRule）と check（判定関数）は AND。admin・system の暗黙の素通しは無い
  - check の無い用途に scopeId を指定したら 400
- **発行**
  - 次のものは 400 にする
    - 型が用途の contentTypes に合わない（strip の用途の画像は jpeg / png / webp / gif / avif だけ。`isAcceptableForPurpose`）
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
  - strip の画像
    - 本来の位置に処理済みの物が既にあれば（前回の commit が書いた後に止まった・並行する commit）、描き直さずにそれで確定する
    - 描き直しで形式が申告と違えば 422（`type_mismatch`）、画素数の上限超え・読めない画像は 422（`process_failed`）。いずれも deleted にして受け取り領域と本来の位置の両方を消す
    - 受け取り領域の原本を消せなければ確定せずに失敗させる（ready になると掃除が原本を追わないため。commit の再試行で消す）
    - 確定の前に取り消された（discard・期限切れ）ら、本来の位置に書いた物を消して 409
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
- **FK cascade**: メディア列を持つ表の行を DB の cascade で消すと、その場では detach されない。cascade は許す。残った紐付けは掃除 cron の照合（下記「掃除」の orphanedAttached）が後の実行で外し、実物を消す。すぐ片付けたい表は restrict にし、子のサービスで消す（任意。[lib/crud README「storage オプション」](../../../lib/crud/README.md)）
- **サーバー内の書き込み**: putFromServer / copy の所有者は呼び出し側が渡す
  - cron・system の書き込みは `null`
  - 利用者・管理者が起点なら、実際の利用者
  - copy は、複製元が無い・外部 URL なら throw する（黙って null にしない）
  - 宛先が strip の用途の画像なら、毎回描き直す（複製元が strip の用途でも。導入前に上がった画像は処理されていないため）。copy は GCS 内の複製ではなく、元を read（宛先の maxBytes まで）→ 描き直し → put になる。描き直せなければ DomainError 422
  - 呼び出し側の注意: 描き直しは画素数に比例して時間とメモリを使う。DB の TX や lock の中で putFromServer / copy を呼ぶと、その間ずっと持ち続ける。発行者プログラム（couponIssuerGrant/issuance.ts）は TX と利用者ごとの advisory lock の中で `issueCodeForOwner` を呼び、画像付きクーポンなら copy（= 描き直し）が lock の中で走る。duplicate（`crudBinding` の duplicateValues）もメディア列ごとに同じ負荷。新しく呼ぶ場所は、なるべく TX の外で先に複製する
- **ユーザーの物理削除**（user の `wrappers/hardDelete.ts`）
  - アバター: users の binding が物理削除と同じ TX で detach（`record_removed`）し、commit 後に実物を消す
  - その人がアップロードし、まだどこにも紐付いていない pending / ready: 物理削除の後に `discardAllOwnedBy(userId)` が取り消して（`discarded`）実物を消す。失敗しても throw しない（掃除 cron が期限・猶予の後に消す）
  - 残すもの: 他の業務行に紐付いたファイル（その行の削除・照合で片付く）、`attach: false` の用途の ready（チャットの添付など、他の人のデータが参照しうる）
  - users に cascade の FK を持つ表（振込明細など）の行は DB が消し、そのファイルは照合が後で消す
- **退会（論理削除）**: 何もしない。行が残る間はアバターも残す（復元できるように）
- **公開の用途の実物とキャッシュ**: 公開の用途は `public, max-age=31536000, immutable` で配信する。台帳と GCS から消しても、利用者のブラウザや中間の CDN のキャッシュには残りうる（URL を知っている人には見えうる）。消すことを約束する文書（プライバシーポリシー等）では、非公開の用途を使うか、この限界を書く

## 実物の削除（`cleanupDeletedObject`）

- 再開可能セッションの行は、先に session URI を DELETE してアップロード権を殺す（`StoragePort.cancelSession`）。そのうえで実物を消し、`object_removed_at` を埋める
- 受け取り中の行（strip）は、受け取り領域の物と、キーから導いた本来の位置の物の両方を消す（commit の途中で止まった処理済みの物も残さない）
- 単発 PUT の署名 URL は取り消せない
  - 期限内に消しても、期限前に再送されると実物が復活しうる
  - そのため、期限内は `object_removed_at` を埋めずに枠も保持する。期限後にもう一度消して完了にする（掃除 cron の役目）
- 失敗はログだけ残して握りつぶす。`deleted` で `object_removed_at` が null の行は、掃除 cron が拾う

## 掃除（cron `storage-sweep`）

`src/app/api/cron/storage-sweep/` → `services/server/sweep.ts`（`runStorageSweep({ lookupService })`）。`runBudgetedBatches` + `createDeadline(STORAGE_CONFIG.sweep.budgetMs)` で、次の 4 種類を id 順に片付ける。`lookupService`（task.ts が `src/wiring/domains.ts` の `lookupDomainService` を渡す）は台帳の `record_type`（= 登録表のキー）から業務行のサービスを引く口で、照合（orphanedAttached）が使う。

| 種類 | 対象 | 処理 |
|---|---|---|
| expiredPending | 期限切れの pending（受け取り中の strip の行を含む） | deleted（reason `expired`）にしてから実物を片付ける。session は URI を中止してから削除、put は期限後なのでそのまま完了。受け取り中の行は本来の位置も消す |
| unattachedReady | 業務行に紐付かないまま `unattachedGraceSec`（既定 24h）を過ぎた ready | deleted（reason `expired`）にして削除。`attach: false` の用途（チャット添付）は対象外。duplicate の失敗で残った複製もここで回収される |
| pendingRemoval | deleted で `object_removed_at` が null の行 | 実物の削除を再試行する。put は期限後だけ（期限内の署名 URL で再送されうるため）、session はいつでも |
| orphanedAttached（照合） | 紐付いた ready のうち、紐付け先の業務行が無くなったもの（DB の cascade・手作業の DELETE などアプリを通らない削除） | record_type ごとに `lookupService(recordType, { require: ["searchWithDeleted"] })` → `searchWithDeleted({ where: { field: CRUD_ID_FIELD, op: "in", value }, limit: 束の ID 数 })` で行の有無を調べ、無い行の紐付けを detach（`record_removed`）して実物を消す。論理削除済みの行は「ある」と数える（restore できるように残す） |

照合（orphanedAttached）の決まり:

- 時間予算は上の 3 種と共有し、その後に回す（既存の片付けを飢えさせない。3 種が予算を使い切った回は照合しない）
- 進み具合は台帳に列を持たず、`cron_checkpoints` の行 `storage-sweep.reconcile` に持つ（台帳 id = uuidv7 の時刻部分。同じミリ秒の行は次回もう一度見るが、照合は何度見ても安全）。最後まで行ったら行を消して先頭に戻る（一巡）。上限で止まった束では進めない
- 上限は `STORAGE_CONFIG.sweep.reconcile`: `maxDetachPerRun`（既定 1000。1 回で片付ける行数）、`massMissingMin`（既定 50。大量一致の閾値）
- detach は ready・紐付け一致の条件付き更新なので、並行する置換・付け替えが先なら外れない
- cron の戻り値: `orphanedAttached { processed, exhausted }` と `reconcile { detached, skipped: [{ recordType, reason, detail? }] }`。skipped は `console.warn` にも出る

### 照合が止まったとき（skipped）

消さずに飛ばした record_type は、その実行の残りでも飛ばす（次の実行でまた調べる）。reason ごとの意味と確かめ方:

| reason | 意味 | 確かめ方・直し方 |
|---|---|---|
| `unregistered` | record_type が serviceRegistry に無い | storageBindingFor の第 1 引数と domainEntry.ts のキーを揃える（`pnpm registry:check` が検出する）。ドメインを消した後なら、台帳の行の扱いを決める |
| `load_failed` | サービスの読み込みが失敗した | detail（例外のメッセージ）とサーバーのログ |
| `unsupported` | サービスが searchWithDeleted を持たない（Firestore 版など） | 照合の対象外。必要ならそのドメインの削除の流れで detach する |
| `mass_missing` | 1 つの束で、同じ record_type の ID が `massMissingMin` 以上あって 1 件も見つからない | 表の取り違え・誤った全消去・truncate を疑う。`pnpm db:query` で台帳（`select record_id from storage_objects where status = 'ready' and record_type = '<type>'`）と業務表を突き合わせる。正当（大きな親の削除で子が一度に消えた）と確かめたら、その間だけ `STORAGE_CONFIG.sweep.reconcile.massMissingMin` を上げて通す。解除の作業コマンドは無い |
| `detach_limit` | 1 回の上限 `maxDetachPerRun` に達した | 次の実行で続きから片付く。続くなら原因（大量削除）を確かめる |

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
  - reason（expired / size_mismatch / type_mismatch / process_failed / discarded / replaced / record_removed / http_deleted。text 列）
- **受け取り中の行**: strip の画像は pending の間 store = priv・key = `incoming/…`。ready になるときに `markReady` が store / key を本来の位置へ書き換える（以後は ref と一致する）
- **session_uri は hiddenColumns**: 生の select では取り出さず、`services/server/finders/findStorageObjectById.ts` だけが読む
- **index はすべて素の列**（push の往復を守る）: unique(store, key) / (status, expires_at) / (owner_user_id, status) / (record_type, record_id) / (status, ready_at)
- **schemaRegistry**: CORE DOMAINS ブロックに登録済み。feature-gate の対象外
- **監査**: 初版は記録しない

## 構成

| ファイル | 役割 |
|---|---|
| `entities/drizzle.ts` / `entities/model.ts` | テーブルと型 |
| `services/server/storageObjectService.ts` | サービス本体。`createStorageObjectService(deps)` で、台帳・ポート・用途表・時刻・ID・画像の描き直し（`stripImage`。省略 = `stripImageMetadata`）を差し替えられる |
| `services/server/policy.ts` | 用途の規則の判定（`evaluateApiAccessRule` + check）と、SessionUser → StorageActor の変換 |
| `services/server/purposeSource.ts` | 用途表の取得口 `getStoragePurposes()`（登録表に `withFixedStripPurposes` をかける。`FIXED_STRIP_PURPOSES` = `user.avatar` は常に strip） |
| `services/server/http.ts` | ルートの入力の検証と、読み取りの応答 |
| `services/server/ledger/` | 台帳の読み書きの境界（`drizzleLedger` / テスト用 `memoryLedger`） |
| `services/server/sweep.ts` / `reconcileCursor.ts` | 掃除 cron の本体と、照合の進み具合（cron_checkpoints） |

## テスト

- `pnpm test:storage-object`: memoryLedger と fake ポートを使った単体テスト。読み取りルートのヘッダーのテストも含む
  - 往復: issue → commit → attach → detach → 掃除対象化
  - strip の受け入れ（実 sharp）: 受け取り領域への発行・最終 ref、commit 後に本来の位置だけに処理済み、原本の削除、途中で止まった commit の再 commit、取り消し・期限切れで両方削除、`type_mismatch` / `process_failed`、HEIC / SVG / TIFF の拒否と keep での受け付け、動画は直送、putFromServer・copy の描き直し、`user.avatar` の固定、`describePurpose`
  - 描き直しを伴わないテストは `stripImage: passThroughImageStrip`（`@/lib/storage/server/fake`）を渡す
  - 発行・commit・取り消し・読み取りの受入項目
  - storage オプションの規則（`crudBinding.test.ts`）、掃除・照合（行が消えた紐付けの detach、引けない record_type、大量一致、上限、予算切れからの続き、一巡）・ユーザーの物理削除の `discardAllOwnedBy`・期限切れ put pending の枠返却（`sweep.test.ts`）
- `pnpm test:storage-object-db`: 実 DB で、条件付き INSERT / UPDATE が並行実行でも一方だけ成功することを確かめる
  - 開発 DB に `test.*` の行を作り、終了時に消す
  - DATABASE_URL が無ければ skip する
  - 先に `pnpm db:push` が必要
