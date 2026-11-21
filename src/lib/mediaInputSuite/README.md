# mediaInputSuite

## Overview

- メディアの入力の lib: メタデータ取得 → プレビュー → storage 基盤(`src/lib/storage`)へのアップロード を一貫して扱う部品とフック。閉じた lib: 入口 `@/lib/mediaInputSuite` だけ(部品・フック・連携・型・関数を全部出す)。読む lib は cn・isClient・storage・unsavedGuard、棚 `@/components`(peers)
- 部品(入力・プレビュー・アップロードの UI)、フック(メタデータ取得・RHF 連携・未採用分の管理)、react-hook-form の連携(`formAdapters/`)、型と検査・整形の関数を持つ
- 連携が読むのは react-hook-form の型とこの lib だけ(フォームの lib `@/lib/formSuite` は読まない)。FieldRenderer の連携は formSuite の側にある

## Usage

### 典型的な使い分け

1. **プレビューとメタデータ取得だけ**
   - `MediaInput` + `onMetadataChange`
   - もしくは `MediaPreview` + `useImageMetadata` / `useVideoMetadata`

2. **アップロードを伴うフォーム**
   - `MediaUploader`（素の state 管理）
   - RHF なら `ControlledMediaUploader` or `useMediaUploaderField`

3. **FieldRenderer で自動生成フォーム**
   - `FieldRenderer` + `baseFields`（domain.json から読み込み）。メディア項目には `purpose` が要る（生成の `<Domain>Fields` が付ける）

### フォーム連携(formAdapters/、入口から読む)

- `ControlledMediaUploader` / `ControlledMediaUploaderMulti` / `ControlledMediaInput`: react-hook-form の `field` を受ける形
- `useMediaUploaderField` / `useMediaUploaderMultiField`: RHF ブリッジ。`render` / `isUploading` / `hasFailed` / `commit` / `reset` を返す(formSuite の media の欄がこれを使う)
- `ManualMediaUploader` / `ManualMediaInput`: 手動の state(value + onChange)で使う形
- `FieldRenderer`(`@/lib/formSuite`)が `mediaUploader` タイプのフィールドを自動処理

### FieldRenderer でメディアの項目を扱う例

```tsx
import type { FieldPath } from "react-hook-form";
import { FieldRenderer, type FieldConfig, type MediaFieldConfig, type MediaState } from "@/lib/formSuite";
import { useMediaMetadataBinding } from "@/lib/mediaInputSuite";
import { domainDisplay } from "@/features/foo/entities/display";

export function FooFields({ methods, onMediaStateChange }) {
  const baseFields = domainDisplay.fields as FieldConfig[];
  const handleMetadata = useMediaMetadataBinding({
    methods,
    binding: { sizeBytes: "filesize" as FieldPath<FooCreateFields> },
  });

  const mediaTarget = baseFields.find((field) => field.name === "media");
  const fieldPatches: MediaFieldConfig[] = mediaTarget
    ? [{ ...mediaTarget, onMetadataChange: handleMetadata }]
    : [];

  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={baseFields}
      fieldPatches={fieldPatches}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
```

メタデータを別フィールドへ反映したい場合は、`useMediaMetadataBinding` でハンドラを作成し、
`fieldPatches` で対象の `mediaUploader` フィールドに `onMetadataChange` を付与します。

### アップロードと保存の手順

- 業務保存が成功したら `useMediaUploaderField`（formAdapters）の `commit()`(最終値の確定 + 残りの未採用分の取り消し)、やめるなら `reset()`(未採用分を取り消し元の値に戻す)
- 大きさ・縮小の案内文は欄の `helperText` に書く(フィールドの枠が描く)。例: 「大きな写真は長い辺 2048px まで自動で縮小してから送ります」。数値は用途の宣言(`image.maxDimension`)と揃える
- 長寿命フォームでは `usePendingMediaUploads` の `cleanupOnUnmount: false` を検討する(既定は unmount で未採用分を discard)
- 送信中の守りを外す: `guardUnsaved={false}`(既定 true)

## API

### MediaInput

- ドラッグ＆ドロップ/クリックでファイルを選択。
- `validationRule` で MIME/拡張子/サイズを検証し、`formatValidationError` の文言で表示。
- `onMetadataChange` は **選択中ファイルがあるときのみ** 発火（`previewUrl` のみの場合は発火しない）。
- `statusOverlay` はプレビュー上のオーバーレイ、`containerOverlay` は全体を覆って操作を無効化。
- `prepareFile?(file) => Promise<File>`: 選んだファイルを `validationRule` の検査の前に整える（MediaUploader / Multi が用途の宣言の画像の縮小を渡す）。整えている間は全体に「画像を準備中…」（`containerOverlay` があればそちら）。投げたら元のファイルのまま検査へ進む。整えている間に選び直したら後の選択だけを採る（クリア・`resetSignal` も途中の処理を捨てる）。省略 = 今までどおり同期で検査

### MediaUploader

- `MediaInput` を内包し、`uploadToStorage`（`@/lib/storage`）でアップロードする。
- `purpose`（必須）: ファイルの用途 ID `<domain>.<field>`。`src/registry/storagePurposeRegistry.ts` に登録した名前。保存先・型・サイズ上限・アップロードできる人は用途で決まる（保存先パスの指定は無い）。
- 画像の位置情報などのメタデータは、用途が strip（画像を含む用途の既定）ならサーバーが commit で消す。この部品に strip / keep の指定は無い（用途の宣言で決まる。`src/lib/storage/README.md`「位置情報の約束」）。
- `accept`: 表示時に用途の方針をサーバーから得て（`usePurposeMetadata`）、strip の用途なら `image/*` を jpeg / png / webp / gif / avif の列挙に置き換え、それ以外の `image/〜`（HEIC など）を外す（`pickerAcceptFor`。iOS が HEIC を JPEG にして渡すため）。方針が分かるまで・取得に失敗したとき・keep の用途では変えない。
- HEIC など、サーバーが描き直せない画像を strip の用途へ選んだときは、送る前に端末で JPEG にする。開けないブラウザでは `storage/unsupported-image` のエラーを表示する（`uploadToStorage`）。
- **送る前の縮小**: 用途の宣言に画像の縮小の指定（`image: { maxDimension, quality? }`）があれば、サイズの検査の前に `shrinkImageForPurpose`（`@/lib/storage`）で長い辺を縮める。fork の画面のコードは要らない（宣言だけで有効。この部品・欄に縮小の指定は無い）。縮められなかった物は元のまま検査へ進む（失敗に数えない。失敗はアップロードの失敗だけ）。その用途では HEIC なども検査の前に JPEG にする。指定・形・守り方: `src/lib/storage/README.md`「画像の縮小の指定」「送る前の縮小」
- `prepareFile?`（任意）: 呼び出し側の整え（切り抜きなど）。これが先、用途の縮小が後（縮小の約束は残る）。投げたら元のまま
- `reencodeImage`（既定 `false`）: 送る前にブラウザで jpeg / png / webp を描き直す任意の前処理（通信量を減らしたいとき）。位置情報の除去の保証には数えない。
- 値（`onUrlChange` に渡る・`initialUrl` で受ける）は storage ref（`storage://…`）。移行前の旧 URL もそのまま表示・保持できる。プレビューは `MediaPreview` が ref を表示用 URL にする。
- 進捗オーバーレイとキャンセルを内蔵（選択直後から出る）。キャンセルすると発行済みのアップロードは取り消される（discard）。
- 選択するとアップロード中は値が外れる（`onUrlChange(null)`）。アップロードが失敗したとき・オーバーレイの「キャンセル」で止めたときは、選ぶ前の値に戻す（`onUrlChange(<前の値>)`、プレビューも戻る）。更新フォームで保存済みの画像が失敗のあと黙って null で保存されないため。クリア操作（値を外す）は戻さない。
- `onUploadFailedChange(failed)`: 失敗したまま（エラー文を出している）なら `true`。やり直しの開始・成功・クリアで `false`（複数版は失敗した枠を外すと `false`）。利用者の中止は失敗に数えない。AppForm はこれで送信を止める。
- 16MiB を超えるファイルは GCS のセッションで分けて送る（通信の途切れや一時的な 5xx は再試行。詳細: `src/lib/storage/README.md`）。
- `onRegisterPendingUpload` / `onRegisterPendingDelete` を使うと、アップロード完了後や削除時に pending 管理へ通知できる。
- 上げたファイルは、業務の保存（storage binding）で紐付くまで「未採用」。紐付けないまま猶予（既定 24 時間）を過ぎると storage-sweep が消す。デモ（`/demo/media-input`、用途 `demo.media`）で上げたファイルも同じく消える。

### MediaUploaderMulti

- 複数枚アップロード版。`value: string[]`（storage ref の配列）を扱う。`purpose`（必須）・`reencodeImage`・`accept` の置き換え・送る前の縮小と `prepareFile` は単一版と同じ（1 ファイルずつ整えてから検査し、通った物だけ枠を作る。整えている間は件数の横に「画像を準備中…」、その分も件数の上限に数える）。
- 並列アップロード（スロット毎の進捗・キャンセル）、追加スロット、削除、ドラッグ並び替え（`reorderable` で切替）。
- `validationRule.maxItems`（既定 10） / `minItems` で件数制約。
- `onUrlsChange` は利用者の操作（追加・削除・並べ替え・アップロード完了）で確定済 URL が変わったときだけ呼ばれる。初期値（mount 時）や外から `initialUrls` を入れ直したときは呼ばない（AutoSave が開いただけで保存しないため）。
- 表示は正方形グリッド（`MediaThumbGrid` を内包）。動画は controls 非表示の第1フレーム表示。
- `image/*,video/*` 等の `accept` で動画も許可可能。

### MediaThumbGrid

- 正方形グリッド + `@dnd-kit/sortable`（`rectSortingStrategy`）の汎用ラッパ。
- `reorderable=false` 時は `DndContext` をマウントせず、静的グリッドとして表示。
- `renderItem` 経由で各スロットを描画、`trailing` 末尾スロットを差し込める。

### MediaPreview

- `detectMediaType` で image/video/unknown を判定。
- `src` に storage ref を渡せる。種類は ref の拡張子で判定し、表示は `resolveStorageSrc`（非公開は固定 URL `/api/storage/objects/<id>`）。
- `ImagePreview` / `VideoPreview` / `UnsupportedPreview` に振り分け。
- `VideoPreview` は枠と「読み込み中」の文だけを持ち、動画の描画と非公開ファイルの復帰（失敗の文と「再開」）は [Media/AppVideo](../../components/Media/AppVideo/README.md) に任せる。

### フック

| フック | 役割 | 備考 |
| --- | --- | --- |
| `useImageMetadata` / `useVideoMetadata` | 画像/動画のメタデータ取得 | `handleImageLoad` / `handleVideoMetadata` を渡して使用 |
| `useDragAndDrop` | ドラッグ＆ドロップのイベント補助 | `eventHandlers` と `isDragging` を返す |
| `useMediaMetadataBinding` | メタデータを RHF フィールドへ自動反映 | `SelectedMediaMetadata` を受け取り `setValue` |
| `useMediaMetadataActions` | メタデータ値ごとの任意アクション | 取得失敗時は `null` を通知 |
| `usePendingMediaUploads` | 編集中にアップロードした未採用分の登録/確定/取り消し | `cleanupOnUnmount` 既定 `true`。中身は `pendingUploadTracker` |
| `usePendingMediaDeletion` | 互換のために残した空の実装 | 何もしない（下記） |

## Internals

### アップロードと保存の分担

- このセッションでアップロードした ref のうち、保存した最終値に残らなかったもの（差し替え前・削除したもの）は、`commit()` / `reset()` / unmount で discard する。
  - discard するのは storage ref だけ。旧 URL・初期値（保存済みの値）は送らない。サーバーも本人・未紐付けのものしか受け付けない
  - 送れなかった分（ページ遷移で途切れた等）は掃除 cron（storage-sweep）が猶予期間の後に消す
- 採用済み（業務行に保存済み）のファイルはクライアントから消さない。値を差し替え・削除して業務保存すると、サーバーの CRUD 連動（detach）が台帳を deleted にして実物を消す。そのため `usePendingMediaDeletion` は API だけを残した空の実装。

### 送信中の未保存の守り

`MediaUploader` / `MediaUploaderMulti` は送信中(アップロード中)の間、ページの移動・戻る / 進む・再読み込みに確認を出す(`src/lib/unsavedGuard`、理由 = 処理の途中 `inProgress`。確認の文は `src/config/lib/unsavedGuard.config.ts`)。
- フォームの中でも特別な扱いはしない: 守りの元が 1 つ増えるだけで、1 回の移動に確認は 1 回(送信中なら「処理の途中」の文)
- アップロードが済んで保存前の値は、フォームの編集済み(AppForm の守り)が受ける。ここでは守らない(未採用分の追跡で守ると、保存の後の移動で聞いてしまう: 確定は送信の後に走る)

### 検査

- `purpose` の用途が受け付けない型・サイズは、発行の時点でサーバーが 400 にする。`validationRule` は画面での先回りの検査
- MIME/拡張子/サイズの制御は `validationRule` と `formatValidationError` に集まる

### 依存(読む lib)

- `src/lib/unsavedGuard`(送信中の守り)
- `src/lib/storage`(アップロード・取り消し・用途の方針)
- `src/lib/cn`(クラスの結合)
- `react-hook-form`(`formAdapters/` の型だけ。値は読まない)

## Verification

- 送信中の守りの判定 `hooks/uploadGuard.ts`: `pnpm test src/lib/`

## Related

- storage 基盤(用途・位置情報の約束・画像の縮小・呼び出す場所): `src/lib/storage/README.md`
- 未保存の守り: `src/lib/unsavedGuard`
