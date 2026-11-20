# `src/lib/storage`

## Overview

- ファイル保存の基盤。判定するのはアプリのサーバーだけで、ファイル本体はブラウザから GCS へ直接送る。どのファイルが何に使われているかは、台帳（core ドメイン `storageObject`）で管理する。
- 使う時・直す時の決まりは札 .claude/rules/items/lib/storage.md にある。この README は使い方と約束の中身、関数の形は [API.md](./API.md)、仕組みは [Internals.md](./Internals.md)

この lib が持つのは、エンジンに依存しない部品だけ。

- ファイル参照（ref）の形式と表示用 URL への解決
- 配信規則（inline / attachment）
- 用途（purpose）の型と、画像のメタデータの扱い（strip / keep）の判定
- エンジンの境界（StoragePort）と GCS 実装
- 保存先（store）の解決
- 画像の描き直し（サーバー、sharp）
- クライアントのアップロード（`uploadToStorage`）と用途の方針の取得

誰がアップロード・読み取り・削除してよいかの判定、台帳、commit の流れ（受け取り領域から本来の位置へ）は、`src/features/core/storageObject` が持つ（[README](../../features/core/storageObject/README.md)）。この lib は features に依存しない。

> 旧 API（Firebase クライアント SDK の経路・旧アップロード / 削除ルート・createCrudService の旧削除連動オプション）は無い。Firebase Storage のルールはリポ直下の `storage.rules`（全拒否）で、クライアント SDK からは何もできない。

### 全体の流れ

1. 用途を置く（core と fork は `src/features/core/storageObject/purposes/<名前>.ts` の `export const purposes`、生成するドメインは pnpm generate domain がそのドメインの `services/server/storagePurposes.ts` へ、一覧は `pnpm generate registry`。無い用途は拒否）
2. サーバーがアップロード権を発行する。台帳に pending の行を作り、上書き不可の署名 PUT か GCS の再開可能セッションを返す
   - **strip の用途の画像**は、本来の保存先ではなく非公開の受け取り領域（priv バケットの `incoming/`）への権利を返す
3. ブラウザが GCS へ直接送る
4. commit: サーバーが HEAD で size・申告 MIME・generation を照合し、ready にする
   - keep の用途・画像以外の型は、照合だけで中身は検査しない
   - strip の用途の画像は、照合した世代を読んで描き直し（メタデータ全除去）、処理済みの物だけを本来の位置に書いて、受け取った原本を消す
5. 業務行の列に `storage://` の ref を保存する。台帳との紐付けは業務保存と同じトランザクションで行う（1 つのファイルは 1 つの業務行にだけ結ぶ。多くの行が同じ画像を指す時は持ち主の行を 1 つ決める。例: お知らせの画像は回が持つ、[storageObject README](../../features/core/storageObject/README.md)「規則」）
6. 業務行の物理削除に連動して実物を削除する。紐付かなかったもの、DB の cascade などアプリを通らずに業務行が消えたもの（照合）は、掃除 cron が消す
   - 公開の用途の実物は 1 年の immutable で配信するので、消してもブラウザ・CDN のキャッシュには残りうる（[storageObject README](../../features/core/storageObject/README.md)「規則」の「公開の用途の実物とキャッシュ」）

このうち 2・4・5・6 は features/core/storageObject と createCrudService の `storage` オプションの役目。この lib はその部品を提供する。

## Usage

### 表示

値ごとの解決（`resolveStorageSrc`）と公開 base の条件は [API.md](./API.md)「表示: `resolveStorageSrc(value)`」。

- `toStorageDisplaySrc(value)`: ref だけを `resolveStorageSrc` で表示用 URL にし、ref 以外の値（旧 URL・`/` 始まり・`blob:` / `data:` のプレビュー・解決済みの URL）はそのまま返す
  - `resolveStorageSrc` を直接使うと `blob:` / `data:` が null になり、アップロード前のプレビューが消える
  - 表示の部品は内部でこれを使うので、呼び出し側は ref をそのまま渡してよい
- 固定 URL（`/api/storage/` で始まる値）は、呼び出し側の指定に関わらず next/image の最適化を外す
  - 認可済みの画像が最適化キャッシュに残り、他の利用者に配られるのを防ぐ
- 公開 base は `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` から next/image の remotePatterns に入る。旧バケットの 2 パターンも残る
- 非公開の動画・音声を自分で描くプレーヤーは `usePrivateMediaRecovery(src, ref)`（`@/lib/storage/client`）の `videoProps` を要素に広げる（`<video ref={ref} {...recovery.videoProps} />`）。署名期限後の読み直しが配線される
  - 返り値・`status` / `resume()` の扱い: [API.md](./API.md)「非公開の動画・音声: `usePrivateMediaRecovery`」、仕組み: [Internals.md](./Internals.md)

### アップロード: `uploadToStorage`

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
  - ドライバーはサーバーが決める（`storageObjectConfig.sessionThresholdBytes` = 16MiB 以下は単発 PUT、超えると GCS セッション）
  - 送り先（本来の位置か受け取り領域か）もサーバーが決める。クライアントは区別しない
  - 単発 PUT: 署名に含めたヘッダーをそのまま付けて送る。上書き不可・サイズ上限・型は署名で GCS が強制する
  - GCS セッション: 8MiB ずつ `Content-Range` を付けて送る（途中は 308）
    - 通信が途切れたら、すぐ `bytes */<total>` で状態を照会し、続きから再開する
    - GCS が再試行を勧める応答（408 / 429 / 500 / 502 / 503 / 504）は、1s・2s・4s の指数 + 0〜500ms の揺らぎで待ってから同じく照会して続きから送る
    - 通信の途切れと合わせて連続 3 回まで（前進すれば数え直す）。照会自体の失敗も同じ回数に数える
    - それ以外の応答のある失敗（400 / 403 など）は再試行しない
  - 単発 PUT は再試行しない（失敗したら取り消して `onError`）
  - commit は strip の画像の描き直しの分だけ時間がかかる（進捗は転送の分だけ）
- 端末は用途の宣言を推測せず、必要なときだけサーバーの用途の方針を聞く（下記）
- **下ごしらえ**
  - サーバーが描き直せない画像（`STRIP_IMAGE_TYPES` 以外の `image/*`、または型が空で名前が `.heic` / `.heif`）のときだけ、用途の方針を問い合わせる（`needsClientConversion`）
    - strip: 端末で JPEG（品質 0.92）に描き直して送る（`prepareStripImage`）。開けない・描き直せない環境・書き出しが `STRIP_IMAGE_TYPES` の 5 型（jpeg / png / webp / gif / avif）にならないときは、発行の前に `StorageUploadError` code `storage/unsupported-image`（`isStorageUnsupportedImage` で判定、案内文は `UNSUPPORTED_IMAGE_MESSAGE`）。issue も discard も呼ばない
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
- **呼び出す場所**: lib の部品（`MediaUploader` / `MediaUploaderMulti`、lib/mediaInputSuite）と、各ドメインの hook（チャット送信など）。フォームの項目は `MediaUploader` 系の部品（FieldRenderer・MediaHandler 経由を含む）
  - lint（client-service-boundary）は `@/lib/storage/client` を対象にしない(決まりは札)

### 送る前の縮小

```ts
import { shrinkImageFile, shrinkImageForPurpose } from "@/lib/storage/client";

const file = await shrinkImageForPurpose(selected, "album.photo"); // 用途の方針の image で縮める（無ければ元のまま）
const avatar = await shrinkImageFile(cropped, { maxDimension: 512 }); // 指定で縮める（fork が直に呼ぶ口）
```

- 縮めるのは jpeg / png / webp の、長い辺が `maxDimension` を超える物だけ。縦横比を保ち、元と同じ型で書き出す（型・拡張子・透過を変えない）。名前と更新日時は元のまま。向きは EXIF どおりに補正してから測る
- 画質 = `quality / 100`。省略 = `storage.config` の `imageStrip.quality`（jpeg / webp）。png は可逆
- **元のまま返す**（投げない）: 画像以外・gif・svg・avif・HEIC などの対象外の型 / 長い辺が上限以下 / 縮められない環境 / 読めない・書き出せない（console に警告）/ 書き出しが別の型になった / 縮めた方が大きい。縮められなかった物はそのまま送り、サイズの検査とサーバーの描き直しが最後に守る
- `shrinkImageForPurpose` は strip の用途で `image` があるときだけ縮める（方針は `purposeMetadataLoader.loadPolicy` の記憶。取得に失敗したら元のまま）。入力部品（MediaUploader / MediaUploaderMulti）はサイズの検査の前にこれを呼ぶ
- その用途（strip + `image`）では、サーバーが描き直せない画像（HEIC など。`needsClientConversion`）を先に JPEG にしてから縮める（名前は `.jpg`。送る直前の変換を前へ出す。開けなければ元のまま = 送る段で今までどおり止まる）。`image` の無い用途では変換しない（今までどおり送る直前）
- 描き直しの部品 `ImageCodec` の `resize`（省略可）を使う。`browserImageCodec` は createImageBitmap + OffscreenCanvas / canvas

### ファイル選択の accept

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

## API

ref・表示の関数・配信規則・StoragePort・保存先と env・旧 URL・用途の型・用途の方針のルート・メディア列のスキーマは [API.md](./API.md)。

## Extension

### 位置情報の約束

画像の位置情報（EXIF の GPS など）の除去は、サーバーが保証する。端末の処理には頼らない（端末の処理は迂回できるため）。

### 宣言

- 用途の `metadata?: "strip" | "keep"`（`StorageMetadataPolicy`）
  - `strip`: commit 時にサーバーが描き直し、メタデータを全て除いた物だけを保存する
  - `keep`: 受け取ったまま保存する（原本を渡す用途。明示したときだけ）
  - **省略 = strip**（`resolvePurposeMetadata`）。画像を含む用途は既定で strip になる
- 画像以外の型（動画・音声・一般ファイル）には効かない。strip の用途でも受け取ったまま保存する
  - 画像と動画が混ざった用途（`image/*,video/*` など）は、宣言なし（strip）のまま同じ欄で、画像だけを描き直す
- **`user.avatar` は常に strip**。登録表の fork の区画で keep にしても、実行時に strip へ固定される（`storageObject` の `purposeSource.ts` の `FIXED_STRIP_PURPOSES`）。`pnpm test scripts/structure/registry/check-storage-purposes.test.mjs` も keep を問題にする
- domain.json のメディア項目では `"storage": { "metadata": "strip" | "keep" }`（[src/features/README.md](../../features/README.md)「ファイルの保存（storage）」）。pnpm generate domain が登録表の AUTO に明示値で書き出す
- core 用途の値（`src/features/core/storageObject/purposes/`）

| 用途 | metadata |
|---|---|
| `user.avatar` / `chatRoom.image` / `notification.image` / `coupon.image_url` | strip |
| `purchaseRequest.bankProof`（振込明細。管理者が照合する原本）/ `chatRoom.file`（「ファイルとして送る」） | keep |
| `chatRoom.video` / `demo.media` | 宣言なし（`demo.media` は画像だけ処理。`chatRoom.video` は画像を受けない） |

### 保証の文

> strip の用途に保存された画像は、サーバーが描き直して、位置情報・Exif・XMP・IPTC・ICC プロファイルを消したものだけである。

- 描き直していない物は本来の保存先に置かれない。受け取った原本は非公開の受け取り領域にだけあり、commit で消える（commit されなければ掃除 cron が消す）
- サーバー内の書き込み・複製（`putFromServer` / `copy`）も、宛先が strip の用途の画像なら描き直す（複製元が strip の用途でも。導入前に上がった画像は処理されていないため）

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
- 検査（`listStoragePurposeProblems` / pnpm generate domain）: strip（省略を含む）の contentTypes に描き直せない画像の型を書くとエラー、画像の型が無い用途に strip を明示するとエラー

### 画像の縮小の指定

- 縮小は用途ごとに 1 か所で宣言する（手書きの用途は `purposes/` の項目、生成の用途は domain.json の field.storage）
- `maxDimension` = 長い辺の上限（px、1 以上の整数）。超える画像だけを縦横比を保って縮める（小さい画像は描き直さない）。`quality` = 縮めて書き出すときの画質（1〜100 の整数）。省略 = `storage.config` の `imageStrip.quality`
- 省略 = 縮めない（今までどおり）。上流の core の用途（`user.avatar` ほか）には指定を置かない: 値は fork の画面の都合で決まるので、fork は自分の用途（purposes/ の項目・domain.json）で宣言する。core の用途の値は fork から変えられない（用途の受け口に上書きの口は無く、同じ ID は例外）→ core の用途へ送る前に縮めたい fork は `shrinkImageFile(file, spec)` を直に呼ぶ（例: アバターの切り抜きの後）
- strip（省略を含む）の画像の用途にだけ書ける。`metadata: "keep"` の用途・画像の型が無い用途に書くと `listStoragePurposeProblems` のエラー（keep はサーバーが描き直さないので、縮小を守らせられない）
- 守り方: ブラウザが送る前にこの指定で縮め（「送る前の縮小」）、サーバーは描き直しで同じ指定を守らせる（「描き直し」の縮め直し。最後の守り）。どちらも用途の方針（`GET /api/storage/purposes/[purpose]` の `image`）と用途表の同じ値を読む

### 運用値

- `src/config/lib/storage.config.ts`（lib/storage の側の上書き、既定 `src/lib/storage/config.ts`）
  - 読み取り署名の TTL: 画像・ファイル 300 秒 / 動画・音声 900 秒 / probe 120 秒
  - `imageStrip`（strip の描き直しの画素数の上限と品質。「位置情報の約束」）
- 持ち主 `src/features/core/storageObject/config.ts`（`storageObjectConfig`、上書き `src/config/features/storageObject.config.ts`）
- 発行期限: PUT 15 分 / セッション 24 時間
  - GCS のセッション URI 自体は約 1 週間生きるので、中止・期限切れではサーバーが URI を DELETE する
- 未採用の猶予 24 時間 / maxPending の既定 20 / セッションに切り替える閾値 16MiB
- `defaultMaxBytesByPreset`（maxSizeBytes の無いメディア項目の既定）/ 掃除 cron の予算
- アップロード権の発行のレート制限は `src/features/core/rateLimit/config.ts` の `storageIssue`

## Internals

描き直し・非公開の動画・音声の復帰・未設定のとき・Firebase Storage のルールは [Internals.md](./Internals.md)。

### 暫定の点

実機での確認が済むまで、次の 2 点は暫定の実装になっている。

- `issuePut` の署名ヘッダーの組
  - `x-goog-if-generation-match: 0` と `x-goog-content-length-range: 0,<maxBytes>` を署名に含める
  - Content-Type・Cache-Control・Content-Disposition もヘッダーとして署名に含める
  - 確認すること: 上書き不可とサイズ上限が GCS 側で強制されるか
- `issueSession` の開始条件
  - `ifGenerationMatch: 0`・Origin・`contentLength` の宣言
  - 確認すること: 上書き不可と、宣言と違うサイズがどう扱われるか

## Verification

- `pnpm test src/lib/storage/storageRef.test.ts`
  - ref と resolve の純関数
  - inline / attachment の判定（HTML・SVG・画像・一般ファイル）
  - メディア列のスキーマ
  - fake ポート（上書き不可・世代指定・発行時 no-store）
  - 未設定のときの挙動
  - 旧 URL の解析
  - 用途の引き当て
- `pnpm test src/lib/storage/server/imageStrip.test.ts`: 実 sharp での描き直し（GPS 入り EXIF・XMP・IPTC・ICC の全除去と sRGB、各形式、静止画とアニメーションの向き、GIF / WebP のフレーム・ループ・間隔・透過、形式違い、HEIC / SVG、画素数の上限）
- `pnpm test src/lib/storage/client src/lib/mediaInputSuite`: axios の adapter を差し替えて、ルートと GCS を偽物にする。下ごしらえ（方針の問い合わせ・HEIC の変換と unsupported-image・keep での型付け）、方針の記憶、`pickerAcceptFor`、先回りの読み直しの判定（`isSignedReadStale`）、MediaUploader の未採用分の追跡（lib/mediaInputSuite の `pendingUploadTracker`）も同じコマンドで走る
- `pnpm test scripts/structure/registry/check-storage-purposes.test.mjs`: 用途表の検査（metadata の規則を含む）
- 本物のブラウザ（XHR の進捗・中止、canvas、HEIC の変換と iOS の accept、動画の読み直し）は手で確かめる
- 単体テストで `createStorageObjectService` にダミーのバイト列を流すときは、`stripImage: passThroughImageStrip`（`@/lib/storage/server/fake`）を渡す
