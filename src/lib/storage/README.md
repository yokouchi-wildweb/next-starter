# `src/lib/storage`

ファイル保存の基盤。判定するのはアプリのサーバーだけで、ファイル本体はブラウザから GCS へ直接送る。どのファイルが何に使われているかは、台帳（core ドメイン `storageObject`）で管理する。

この lib が持つのは、エンジンに依存しない部品だけ。

- ファイル参照（ref）の形式と表示用 URL への解決
- 配信規則（inline / attachment）
- 用途（purpose）の型と、画像のメタデータの扱い（strip / keep）の判定
- エンジンの境界（StoragePort）と GCS 実装
- 保存先（store）の解決
- 画像の描き直し（サーバー、sharp）
- クライアントのアップロード（`uploadToStorage`）と用途の方針の取得

誰がアップロード・読み取り・削除してよいかの判定、台帳、commit の流れ（受け取り領域から本来の位置へ）は、`src/features/core/storageObject` が持つ（[README](../../features/core/storageObject/README.md)）。この lib は features に依存しない。

> ファイルのアップロード・読み取り・削除は、すべてこの基盤（とドメインの binding / `storageObjectService`）を通す。旧 API（Firebase クライアント SDK の経路・旧アップロード / 削除ルート・createCrudService の旧削除連動オプション）は N2 `storage-cutover` で削除した。Firebase Storage のルールはリポ直下の `storage.rules`（全拒否）で、クライアント SDK からは何もできない。

## 全体の流れ

1. 用途を置く（core と fork は `src/features/core/storageObject/purposes/<名前>[.<fork の名前>].ts` の `export const purposes`、業務ドメインは dc:generate が `src/registry/storagePurposeRegistry.ts` の AUTO の区画へ。無い用途は拒否）
2. サーバーがアップロード権を発行する。台帳に pending の行を作り、上書き不可の署名 PUT か GCS の再開可能セッションを返す
   - **strip の用途の画像**は、本来の保存先ではなく非公開の受け取り領域（priv バケットの `incoming/`）への権利を返す
3. ブラウザが GCS へ直接送る
4. commit: サーバーが HEAD で size・申告 MIME・generation を照合し、ready にする
   - keep の用途・画像以外の型は、照合だけで中身は検査しない
   - strip の用途の画像は、照合した世代を読んで描き直し（メタデータ全除去）、処理済みの物だけを本来の位置に書いて、受け取った原本を消す
5. 業務行の列に `storage://` の ref を保存する。台帳との紐付けは業務保存と同じトランザクションで行う
6. 業務行の物理削除に連動して実物を削除する。紐付かなかったもの、DB の cascade などアプリを通らずに業務行が消えたもの（照合）は、掃除 cron が消す
   - 公開の用途の実物は 1 年の immutable で配信するので、消してもブラウザ・CDN のキャッシュには残りうる（[storageObject README](../../features/core/storageObject/README.md)「規則」の「公開の用途の実物とキャッシュ」）

このうち 2・4・5・6 は features/core/storageObject と createCrudService の `storage` オプションの役目。この lib はその部品を提供する。

## 構成

| ファイル | 実行環境 | 役割 |
|---|---|---|
| `index.ts` | client-safe | 入口（ref・配信規則・metadata の判定・スキーマ・用途の型） |
| `ref.ts` | client-safe | ref の組み立て・解析、`resolveStorageSrc`・`toStorageDisplaySrc`、公開 base・固定 URL の判定（`publicStorageBaseUrl` / `isPublicStorageUrl` / `isPrivateObjectPath` / `publicStorageHosts`） |
| `contentTypes.ts` | client-safe | 型の照合、拡張子の対応表、inline / attachment の判定 |
| `metadata.ts` | client-safe | 画像のメタデータの扱いの判定（`STRIP_IMAGE_TYPES` / `resolvePurposeMetadata` / `requiresStrip` / `isAcceptableForPurpose`） |
| `schema.ts` | client-safe | メディア列の値の zod スキーマ `storageMediaValueSchema` |
| `policy/types.ts` | client-safe | 用途の型 `StoragePurpose`・`StorageMetadataPolicy` ほか |
| `server/index.ts` | server | サーバー専用の入口 |
| `server/port.ts` | server | `StoragePort`（エンジンの境界）と `getStoragePort()`、`StorageReadTooLargeError` |
| `server/gcs.ts` | server | GCS 実装（Firebase Admin の `getServerStorage()` 経由） |
| `server/fake.ts` | server（テスト） | メモリ上の実装と `__setStoragePortForTest`、`passThroughImageStrip` |
| `server/stores.ts` | server | 保存先 → バケット・prefix の解決、`StorageNotConfiguredError` |
| `server/purposes.ts` | server | 用途表からの引き当て、形式の検査（`listStoragePurposeProblems`） |
| `server/legacy.ts` | server | 旧バケットの旧 URL → 位置の変換 |
| `server/imageStrip.ts` | server | 画像の描き直し `stripImageMetadata`（sharp）と `ImageStripError` |
| `client/index.ts` | client | クライアントの入口（`uploadToStorage` ほか） |
| `client/uploadToStorage.ts` | client | 下ごしらえ → 発行 → 転送 → commit の流れ、中止・失敗時の取り消し |
| `client/storageClient.ts` | client | アプリのルート（発行・commit・取り消し・削除・用途の方針）の HTTP クライアント |
| `client/drivers/put.ts` / `client/drivers/gcsSession.ts` | client | GCS への直接転送（単発 PUT / 再開可能セッション） |
| `client/purposePolicy.ts` / `client/usePurposeMetadata.ts` | client | 用途の方針（strip / keep）の取得と用途ごとの記憶、React から読む hook |
| `client/prepareStripImage.ts` | client | strip の用途へ送る前の HEIC などの JPEG 変換、型が空の .heic / .heif の型付け |
| `client/pickerAccept.ts` | client | ファイル選択の accept を用途の方針に合わせる `pickerAcceptFor` |
| `client/reencodeImage.ts` | client | 任意の描き直し（既定 OFF）と、描き直しの部品 `ImageCodec` |
| `client/transferTypes.ts` | client | 進捗・中止の型、ルートの応答の形、`StorageUploadError` |
| `client/usePrivateMediaRecovery.ts` | client | 非公開の動画・音声の、署名期限後の読み込み失敗からの復帰と先回りの読み直し |

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
- ref が指す物が確定するのは commit の完了時。発行の応答の ref は予定の値（strip の画像は、その時点では受け取り領域にあり、ref の位置にはまだ何も無い）。業務行に保存するのは commit の応答の ref

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
- `publicStorageHosts()` は公開 base のホストを返す。CORS 診断の表示に使う
- next/image の許可は `isPublicStorageUrl(src)`（公開 base + `/` の前方一致）で判定する
  - `storage.googleapis.com` のようにホストが共有のとき、ホストだけで許可すると他のバケットの URL まで最適化に通ってしまうため
  - `next.config.ts` の remotePatterns も同じ base のパス配下に限る

### 表示側の配線

- 表示部品が src に渡す前は `toStorageDisplaySrc(value)` を通す: ref だけを `resolveStorageSrc` で表示用 URL にし、ref 以外の値（旧 URL・`/` 始まり・`blob:` / `data:` のプレビュー・解決済みの URL）はそのまま返す
  - `resolveStorageSrc` を直接使うと `blob:` / `data:` が null になり、アップロード前のプレビューが消える
  - 使っている部品: `AppImage`（src/components/Media/AppImage）、`ImageViewer`（`openImage` / `ZoomableImage`）、`DetailModal`（media の url・poster）。呼び出し側は ref をそのまま渡してよい
- 固定 URL（`/api/storage/` で始まる値）は、呼び出し側の指定に関わらず next/image の最適化を外す
  - 認可済みの画像が最適化キャッシュに残り、他の利用者に配られるのを防ぐ
- 公開 base は `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` から next/image の remotePatterns に入る。旧バケットの 2 パターンも残る

### 非公開の動画・音声: `usePrivateMediaRecovery(src, mediaRef)`

固定 URL は 302 で短期署名 URL（動画・音声は `readTtlSec.video` / `audio`）へ飛ぶ。ブラウザは 302 先の署名 URL を使い回して Range 取得するため、期限後のシークで読み込みに失敗することがある。

- 失敗すると、位置・再生中かどうか・速度を覚え、固定 URL に非永続の再取得 query（`_r`）を付けて読み直し、同じ位置へ戻す
- 自動復帰は 1 回の失敗に 1 回だけ。復帰直後にまた失敗したら `status: "failed"` で止まる
  - 呼び出し側はエラーと「再開」操作を出し、`resume()` を呼ぶ
- **許可を失った場合（logout・退室・削除で 401/404）は、自動では再試行しない**
  - HTTP の状態は見ない（ブラウザで 302 を追わずに状態を知るには fetch が要り、client HTTP は axios だけという規約に例外を作らないため）
  - 自動復帰 1 回の後は `failed` で止まる。再開しても許可が無ければ、また `failed` に戻る
- **先回りの読み直し**: 読み込み開始（`loadstart`）から `readTtlSec(video|audio) − 30 秒`（`PROACTIVE_RELOAD_MARGIN_SEC`）を過ぎた要素で再生・シークが起きたら、失敗を待たずに同じ手順で読み直す
  - Chrome は期限後のシークで約 27 秒待ってからエラーを出すため、待たせずに済むようにする
  - 失敗ではないので自動復帰の回数は使わない。ブラウザの判別はしない
  - 署名は読み込み開始より後に発行されるので、開始時刻から数えると早めに倒れる
- src が固定 URL でなければ何もしない（旧 URL・公開 URL はそのまま）
- 配線済み: `VideoPreview`（lib/mediaInputSuite）、`DetailModal` の動画（`DetailModalVideo`）。props の追加は無い
- 独自のプレーヤーに配線するとき: `recovery.src` を要素の `src` に、`handleError` / `handleLoadedMetadata` / `handleCanPlay` / `handleLoadStart` を同名のイベントに、`handlePlaybackIntent` を `onPlay` と `onSeeking` に渡し、`status === "failed"` でエラーと `resume()` の操作を出す
- 全ページの署名更新の仕組みは作らない
- 要素の `src` 属性で渡す。`<source>` 子要素だと読み込み失敗の error が `<source>` 側に出て、media 要素の onError に届かない

## 配信規則（inline / attachment）

受け付けてよい型（用途の `contentTypes`）と、ブラウザに inline 表示させてよい型は分けて扱う。

- inline にするのは `INLINE_CONTENT_TYPES` の固定表だけ
  - 載っているのは画像（jpeg / png / gif / webp / avif）・動画・音声
  - 下流から追加する口は無い
- 次のものはすべて `Content-Disposition: attachment` にする
  - **HTML・SVG・XML などの文書型**
  - 表に無い一般ファイル
  - 不正な型
- keep の用途で `image/svg+xml` を受け付けても、SVG は attachment で配信される（strip の用途はそもそも SVG を受け付けない）
- `contentDispositionFor(contentType)` を、公開・非公開の両方に使う
  - 公開ファイル: オブジェクトの metadata。ポートの issuePut / issueSession / put / copy が自動で付ける
  - 非公開ファイル: 署名 URL の応答指定（`signRead` の `responseDisposition`）。省略時は attachment
- 型の照合（`matchesContentType`）は完全一致と `type/*`。比較の前に小文字化し、パラメータを外す

## 位置情報の約束（画像のメタデータ: strip / keep）

画像の位置情報（EXIF の GPS など）の除去は、サーバーが保証する。端末の処理には頼らない（端末の処理は迂回できるため）。

### 宣言

- 用途の `metadata?: "strip" | "keep"`（`StorageMetadataPolicy`）
  - `strip`: commit 時にサーバーが描き直し、メタデータを全て除いた物だけを保存する
  - `keep`: 受け取ったまま保存する（原本を渡す用途。明示したときだけ）
  - **省略 = strip**（`resolvePurposeMetadata`）。画像を含む用途は既定で strip になる
- 画像以外の型（動画・音声・一般ファイル）には効かない。strip の用途でも受け取ったまま保存する
  - 画像と動画が混ざった用途（`image/*,video/*` など）は、宣言なし（strip）のまま同じ欄で、画像だけを描き直す
- **`user.avatar` は常に strip**。登録表の fork の区画で keep にしても、実行時に strip へ固定される（`storageObject` の `purposeSource.ts` の `FIXED_STRIP_PURPOSES`）。`pnpm test:storage-purposes` も keep を問題にする
- domain.json のメディア項目では `"storage": { "metadata": "strip" | "keep" }`（[src/features/README.md](../../features/README.md)「ファイルの保存（storage）」）。dc:generate が登録表の AUTO に明示値で書き出す
- core 用途の値（`src/features/core/storageObject/purposes/`）

| 用途 | metadata |
|---|---|
| `user.avatar` / `chatRoom.image` / `notification.image` / `coupon.image_url` | strip |
| `purchaseRequest.bankProof`（振込明細。管理者が照合する原本）/ `chatRoom.file`（「ファイルとして送る」） | keep |
| `chatRoom.video` / `demo.media` | 宣言なし（`demo.media` は画像だけ処理。`chatRoom.video` は画像を受けない） |

### 保証の文

> strip の用途に保存された画像は、サーバーが描き直して、位置情報・Exif・XMP・IPTC・ICC プロファイルを消したものだけである。

- 描き直していない物は本来の保存先に置かれない。受け取った原本は非公開の受け取り領域にだけあり、commit で消える（commit されなければ掃除 cron が消す）
- サーバー内の書き込み・複製（`putFromServer` / `copy`）も、宛先が strip の用途の画像なら毎回描き直す（複製元が strip の用途でも。導入前に上がった画像は処理されていないため）

### 対象外（約束しないもの）

- keep の用途の画像
- 動画・音声のメタデータ（撮影位置を含みうる）
- 動画などと偽って申告された画像（混在用途で `video/mp4` などとして送られた物は描き直さない。中身の形式は見ない）
- この仕組みの導入前に保存されたファイル（旧 URL を含む）。遡って処理はしない
- 画像そのものに写っている情報（風景・看板・画面の写り込みなど）

### fork の公開文書（プライバシーポリシー・ヘルプ等）に書くとき

- 書いてよい: 「〇〇（用途の名前）にアップロードされた画像は、保存の前に位置情報などのメタデータを削除します」のように、**strip の用途を名指しした**表現
- 書いてはいけない（無条件に書かない）
  - 「すべての画像から位置情報を削除します」— keep の用途・導入前のファイル・動画がある
  - 「運営者を含め位置情報を取得しません」— 原本はいったん受け取り領域に置かれ、サーバーが読む
  - 「写真・動画から位置情報を削除します」— 動画は対象外
- 用途を keep にしたら、その用途についての記述を見直す

### 受付形式

- strip の用途で受け付ける画像は `STRIP_IMAGE_TYPES` の 5 型だけ: `image/jpeg` / `image/png` / `image/webp` / `image/gif` / `image/avif`
  - `contentTypes` の `"image/*"` はこの 5 型に読み替える
  - HEIC / HEIF・SVG・TIFF など、サーバーが描き直せない画像の型は、contentTypes に書いてあっても発行で 400
  - 判定は `isAcceptableForPurpose(purpose, contentType)`。発行・commit・putFromServer・copy の照合はすべてこれを使う
- これらを受けたい用途は keep を明示する
- 検査（`listStoragePurposeProblems` / dc:generate）: strip（省略を含む）の contentTypes に描き直せない画像の型を書くとエラー、画像の型が無い用途に strip を明示するとエラー

### 描き直し: `stripImageMetadata(body, contentType)`（`server/imageStrip.ts`、server-only）

- sharp で描き直す。sharp（ネイティブ）は初回の呼び出しで読み込む（`@/lib/storage/server` を使うだけのルートの起動を重くしない）
- メタデータを書く API（`withMetadata` / `keepExif` / `keepIccProfile` など）は呼ばない。EXIF（位置情報を含む）・XMP・IPTC・ICC を残さない
- **ICC**: sRGB に変換してから落とす（sharp の既定）。P3 などの広色域は、P3 画面での鮮やかさが少し落ちる。標準プロファイルへの置き換え（P3 保持）は持たない
- 出力は入力と同じ形式（jpeg → jpeg … avif → avif）。縮小はしない
- **向き**
  - 静止画: EXIF の向きどおりに回転してから向きのタグを捨てる
  - アニメーション: 向き 2〜4（反転・180 度）だけ補正する。5〜8（90 / 270 度回転を含む）は、sharp が複数ページの回転に対応しないため、**回転せずに向きの情報を捨てる**（表示が横倒しになりうる）
  - 3・4 はフレームごとに補正して並べ直す（全体にかけるとフレームの順番が逆になるため。ループ・コマ間隔は元の値を付け直す）
- **アニメーション**: GIF / WebP はフレーム・ループ回数・コマ間隔・透過を保つ。APNG と動く AVIF は 1 枚目だけになる（静止画として保存）
- **上限**: ヘッダーだけを読んで画素数を先に判定する。1 フレームの画素数（幅 × 高さ）が `maxFramePixels`、全フレームの合計が `maxTotalPixels` を超えたら `ImageStripError("too_large")`
- 失敗: 実際の形式が申告と違う → `"type_mismatch"` / 読めない・処理できない → `"unprocessable"`。commit では行を deleted にして 422（[storageObject README](../../features/core/storageObject/README.md)）
- 値は `src/config/app/storage.config.ts` の `imageStrip`（fork が調整してよい）

| キー | 既定 |
|---|---|
| `maxFramePixels` | 1 億画素 |
| `maxTotalPixels` | 1 億画素 |
| `quality.jpeg` / `quality.webp` / `quality.avif` | 90 / 90 / 60（png / gif は sharp の既定） |

- 時間とメモリ: commit は描き直しの分だけ重くなる（画素数次第）。Vercel（2GB / 2vCPU）での試験では、4,600 万画素の WebP（200 フレーム）で 8.4 秒・最大 RSS 約 618MB

## エンジンの境界: `StoragePort`

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

実装が守る約束:

- **書き込み先は上書き不可**（`ifGenerationMatch: 0`）。issuePut / issueSession / put / copy のすべてに適用
- **発行時の Cache-Control は `no-store` 固定**（`ISSUED_CACHE_CONTROL`。呼び出し側からは指定させない）
  - 公開ファイルは commit の照合後に `setCacheControl` で、その generation だけを長期 cache にする
  - 非公開ファイルは常に no-store
- generation を受ける操作は、指定があればその世代だけを対象にする（照合した世代と違う中身を配らない・読まない・消さない）
- Content-Disposition は「配信規則」のとおり実装が付ける
- 認可はしない。呼び出し側（features/core/storageObject）が判定してから使う
- strip の描き直しは、専用のメソッドを持たず read（原本を読む）→ put（本来の位置に書く）→ delete（原本を消す）で行う
- StoragePort を自前で実装する場合は read も実装する（fake は同梱）

## 保存先（store）と env

| store | env | 用途 |
|---|---|---|
| `pub` | `STORAGE_PUBLIC_BUCKET`（必須）/ `STORAGE_PUBLIC_PREFIX`（任意） | 公開バケット（UBLA、allUsers に get のみ） |
| `priv` | `STORAGE_PRIVATE_BUCKET`（必須）/ `STORAGE_PRIVATE_PREFIX`（任意） | 非公開バケット（UBLA、公開アクセス防止）。strip の画像の受け取り領域（`incoming/`）もここ |
| `legacy` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 旧バケット。ref には出ない。サーバー内部で旧 URL の解析・削除・コピーにだけ使う |

- `locationOf(store, objectKey)` で物理位置（`{ bucket, path }`）を得る
- pub / priv の env が無ければ `StorageNotConfiguredError` ですぐに失敗する
  - strip の画像は公開の用途でも priv で受け取るので、`STORAGE_PRIVATE_BUCKET` が無いと公開の用途の画像の発行も失敗する
- **既定バケットへの読み替え（暗黙の fallback）はしない**。旧バケットには新しいファイルを置かない（配備の順序によっては旧バケットに緩いルールが残っている期間がある）
- 新しい 2 つのバケットは Firebase に登録しない（クライアント SDK からの経路を作らない）
- バケットの作成・権限・CORS は `pnpm storage:setup` で行う（priv の CORS は受け取り領域へのアップロードにも使われる）。手順・必要な権限・組織のポリシーで止まる場合・location の注意: [scripts/storage/README.md](../../../scripts/storage/README.md)

## 旧 URL: `server/legacy.ts`

- 既存のメディア（旧 URL）は公開のまま凍結する。新しい API は旧 URL を受け付けない
- `parseLegacyStorageUrl(url)` は、自分の旧バケットの URL を位置に変換する
  - 対象は Firebase のトークン付きダウンロード URL と、`storage.googleapis.com/<bucket>/...`
  - 外部 URL・他バケットの URL・旧バケットが未設定なら null
  - pub / priv の保存先と重なる位置（同じバケットで prefix 配下）も null。管理下の物を旧 URL として copy・削除・probe させないため。`isLegacyLocation(location)` が同じ判定
  - 旧バケットを pub / priv と共有し prefix が `""` の構成では、旧バケットのどの URL も旧 URL として扱われない（旧物の copy・削除連動・probe ができない。安全側）
- 使ってよいのは次の 3 つだけ
  - 業務行の物理削除に連動する削除
  - 管理者による複製（copy で新しい ref にする。宛先が strip の用途の画像なら描き直す）
  - 管理者のメディア解析（`/api/media/probe` の storagePath / downloadUrl）
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
  metadata?: "strip" | "keep";       // 画像のメタデータの扱い。省略 = strip（「位置情報の約束」）
};
```

- allow（既存の DomainApiAccessRule の語彙）と check（任意の判定関数）は AND。暗黙に判定を通る道（admin・system の素通し）は無い
- `resolveStoragePurpose(map, id)` は、未登録なら `StoragePurposeNotFoundError`（400）を投げる。`findStoragePurpose(map, id)` は未登録で undefined
- `listStoragePurposeProblems(map)` は用途表の形式を検査する（metadata の値・描き直せない画像の型・画像の無い用途の strip・`user.avatar` の keep を含む）。用途の登録表との結線は `src/registry/storagePurposeRegistry.ts` で行う

## クライアント: `uploadToStorage`

```ts
import { uploadToStorage, isStorageUploadCanceled } from "@/lib/storage/client";

const { cancel } = uploadToStorage(file, {
  purpose: "user.avatar",           // 用途 ID
  scopeId,                          // 用途の check が使う範囲（任意）
  reencodeImage: false,             // 既定 false（任意の描き直し。保証には数えない）
  onProgress: ({ percent }) => setPercent(percent),
  onComplete: ({ ref, objectId, src }) => setValue(ref), // 業務行には ref を保存する
  onError: (error) => isStorageUploadCanceled(error) || toast.error(error.message),
});
```

- **流れ**: 下ごしらえ（下記）→ アップロード権の発行（`POST /api/me/storage/uploads`）→ 種類に合うドライバーで GCS へ直接送る → commit
  - ドライバーはサーバーが決める（`STORAGE_CONFIG.sessionThresholdBytes` = 16MiB 以下は単発 PUT、超えると GCS セッション）
  - 送り先（本来の位置か受け取り領域か）もサーバーが決める。クライアントは区別しない
  - 単発 PUT: 署名に含めたヘッダーをそのまま付けて送る。上書き不可・サイズ上限・型は署名で GCS が強制する
  - GCS セッション: 8MiB ずつ `Content-Range` を付けて送る（途中は 308）
    - 通信が途切れたら、すぐ `bytes */<total>` で状態を照会し、続きから再開する
    - GCS が再試行を勧める応答（408 / 429 / 500 / 502 / 503 / 504）は、1s・2s・4s の指数 + 0〜500ms の揺らぎで待ってから同じく照会して続きから送る
    - 通信の途切れと合わせて連続 3 回まで（前進すれば数え直す）。照会自体の失敗も同じ回数に数える
    - それ以外の応答のある失敗（400 / 403 など）は再試行しない
  - 単発 PUT は再試行しない（失敗したら取り消して `onError`）
  - commit は strip の画像の描き直しの分だけ時間がかかる（進捗は転送の分だけ）
- **呼び出し側は strip / keep を指定しない**。端末は用途の宣言を推測せず、必要なときだけサーバーの用途の方針を聞く（下記）
- **下ごしらえ**
  - サーバーが描き直せない画像（`STRIP_IMAGE_TYPES` 以外の `image/*`、または型が空で名前が `.heic` / `.heif`）のときだけ、用途の方針を問い合わせる（`needsClientConversion`）
    - strip: 端末で JPEG（品質 0.92）に描き直して送る（`prepareStripImage`）。開けない・描き直せない環境・書き出しが 5 型にならないときは、発行の前に `StorageUploadError` code `storage/unsupported-image`（`isStorageUnsupportedImage` で判定、案内文は `UNSUPPORTED_IMAGE_MESSAGE`）。issue も discard も呼ばない
    - keep: 変換しない。型が空の `.heic` / `.heif` は `image/heic` / `image/heif` として申告する（`withInferredImageType`）
    - 方針を得られない（通信失敗など）: 変換しない（keep の用途を誤って変えない側に倒す。strip の用途ならサーバーが発行を 400 で拒否する）
  - それ以外（5 型の画像・動画・ファイル）は問い合わせない（往復は増えない）
  - JPEG 変換は透過を失う（透過のある HEIC はまれ）
- **任意の描き直し**（`reencodeImage`、既定 false）: jpeg / png / webp を送る前にブラウザで描き直す。通信量を減らしたいときの前処理で、位置情報の除去の保証には数えない
  - 向きは EXIF に従って補正する。gif・svg・その他はそのまま。描き直した方が大きくても、描き直した方を使う
  - 描き直せない環境（`createImageBitmap` / canvas が無い）では元のまま送る
  - HEIC などを JPEG に変換した物には重ねない
- **中止・失敗**
  - `cancel()` や失敗のときは、発行済みなら取り消し（`DELETE /api/me/storage/uploads/[id]`）を試みる。セッションの URI はサーバーが中止する
  - 中止は `onError` に code `storage/canceled` の `StorageUploadError` を渡す
- **HTTP**
  - アプリのルートは `storageClient`（axios + `normalizeHttpError`）
  - GCS への直接転送も axios で行う（ブラウザでは XHR になり、`onUploadProgress` で進捗、`AbortSignal` で中止）。アプリの Cookie は送らない（`withCredentials: false`）
- **ルートの応答の形**（`IssueUploadResponse` / `CommitUploadResponse` / `PurposePolicyResponse`）: features/core/storageObject の `storageObjectService` と揃えて `transferTypes.ts` に持つ（lib は features に依存しない。同一は `transferTypes.check.ts` が型で確かめる）
- **呼び出す場所**: lib の部品（`MediaUploader` / `MediaUploaderMulti`、lib/mediaInputSuite）と、各ドメインの hook（チャット送信など）から呼ぶ
  - features・app の UI 部品から直接呼ばない。フォームの項目は `MediaUploader` 系の部品（FieldRenderer・MediaHandler 経由を含む）、それ以外は送信を受け持つドメインの hook を使う
  - lint（client-service-boundary）は `@/lib/storage/client` を対象にしないため、この規約は README で持つ

### 用途の方針: `GET /api/storage/purposes/[purpose]`

- 応答 `{ metadata: "strip" | "keep" }`（`storageObjectService.describePurpose`。`user.avatar` は常に strip）
- ログイン必須（createApiRoute `authenticated`）。未登録・ID の形式違いは 404。誰が聞いても同じ答えなので `/api/me/` には置かない
- `Cache-Control: private, max-age=300`
- クライアントは `purposeMetadataLoader`（`purposePolicy.ts`）が用途ごとに記憶する（ページの寿命の間。同時の呼び出しはまとめる。失敗は記憶せず次で取り直す）。`uploadToStorage` と `usePurposeMetadata` が同じ記憶を共有する
- strip で受け付ける画像の型は、サーバーと同じ共有定数 `STRIP_IMAGE_TYPES`（client-safe）を端末が使う。応答には含めない
- route を列挙・制限している仕組み（独自の proxy・WAF など）では、このパスを通す

### ファイル選択の accept: `pickerAcceptFor(accept, metadata)`

- strip のとき、accept の `image/*` を 5 型の列挙に置き換え、5 型以外の `image/〜`（`image/heic` など）を外す
  - iOS は accept が HEIC を含まない具体型の列挙なら写真を JPEG に変換して渡し、`image/*` なら HEIC のまま渡すため
  - 拡張子（`.heic` など）と画像以外の型はそのまま。外して空になったら 5 型（空 = 何でも選べる にしない）
- keep・accept なしのときは変えない
- `MediaUploader` / `MediaUploaderMulti` は表示時に `usePurposeMetadata(purpose)` で方針を得て、`pickerAcceptFor(accept, metadata ?? "keep")` を使う（分かるまで・取得失敗時は狭めない。ログイン前の画面では 401 で狭めない）
- 自前の file input で同じことをする場合

```tsx
const metadata = usePurposeMetadata(purpose);
<input type="file" accept={pickerAcceptFor(accept, metadata ?? "keep")} />
```

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
- `imageStrip`（strip の描き直しの画素数の上限と品質。「位置情報の約束」）
- アップロード権の発行のレート制限は `rate-limit.config.ts` の `storageIssue`

## 未設定のとき（UNCONFIGURED_BACKENDS）

- `resolveStorageSrc` は例外を投げない（公開 base が無ければ pub の ref に null）
- ポートの構築、各モジュールの import は env が空でも落ちない（sharp も初回の描き直しまで読み込まない）
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

- `pnpm test:storage-ref`
  - ref と resolve の純関数
  - inline / attachment の判定（HTML・SVG・画像・一般ファイル）
  - メディア列のスキーマ
  - fake ポート（上書き不可・世代指定・発行時 no-store）
  - 未設定のときの挙動
  - 旧 URL の解析
  - 用途の引き当て
- `pnpm test:storage-strip`: 実 sharp での描き直し（GPS 入り EXIF・XMP・IPTC・ICC の全除去と sRGB、各形式、静止画とアニメーションの向き、GIF / WebP のフレーム・ループ・間隔・透過、形式違い、HEIC / SVG、画素数の上限）
- `pnpm test:storage-client`: axios の adapter を差し替えて、ルートと GCS を偽物にする。下ごしらえ（方針の問い合わせ・HEIC の変換と unsupported-image・keep での型付け）、方針の記憶、`pickerAcceptFor`、先回りの読み直しの判定（`isSignedReadStale`）、MediaUploader の未採用分の追跡（lib/mediaInputSuite の `pendingUploadTracker`）も同じコマンドで走る
- `pnpm test:storage-purposes`: 用途表の検査（metadata の規則を含む）
- 本物のブラウザ（XHR の進捗・中止、canvas、HEIC の変換と iOS の accept、動画の読み直し）は手で確かめる
- 単体テストで `createStorageObjectService` にダミーのバイト列を流すときは、`stripImage: passThroughImageStrip`（`@/lib/storage/server/fake`）を渡す

## Firebase Storage のルール（全拒否）

- リポ直下の `storage.rules` と `firebase.json` を upstream が同梱する。業務のポリシーは一切持たない（判定はアプリのサーバーだけ）
- 配備: `firebase deploy --only storage --project <project-id>`。既存のプロジェクトでは、アプリの配備 → 新しい経路の確認 → ルールの配備 → 旧 URL の確認、の順（docs/setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md §6.1）
- 旧 URL（ダウンロードトークン付き URL・公開 URL）はルールを通らないので、配備後も読める
