# mediaInputSuite 利用ガイド

本ドキュメントは `src/lib/mediaInputSuite` のコンポーネント/フックの役割と、フォーム連携時の使い分けをまとめたものです。**メタデータ取得 → プレビュー → Firebase Storage へのアップロード** を一貫して扱うためのリファレンスとして活用してください。

> このフォルダはライブラリ本体です。RHF 連携のラッパー (`src/components/Form/MediaHandler`) や FieldRenderer 連携 (`src/components/Form/FieldRenderer`) は別フォルダにあります。

---

## 1. ライブラリ構成

```
src/lib/mediaInputSuite
  components/MediaInput.tsx
  components/MediaUploader.tsx
  components/MediaPreview.tsx
  components/ImagePreview.tsx
  components/VideoPreview.tsx
  components/UnsupportedPreview.tsx
  hooks/useImageMetadata.ts
  hooks/useVideoMetadata.ts
  hooks/useDragAndDrop.ts
  hooks/useMediaMetadataBinding.ts
  hooks/useMediaMetadataActions.ts
  hooks/useMediaUploaderField.tsx
  hooks/usePendingMediaUploads.ts
  hooks/usePendingMediaDeletion.ts
  hooks/useMockUploader.ts
  types.ts
  utils.ts
```

- components: 入力/プレビュー/アップロードの UI を提供
- hooks: メタデータ取得、RHF 連携、pending 管理
- types/utils: 型定義とバリデーション・フォーマット関数

---

## 2. 主要コンポーネント

### 2.1 MediaInput (`src/lib/mediaInputSuite/components/MediaInput.tsx`)

- ドラッグ＆ドロップ/クリックでファイルを選択。
- `validationRule` で MIME/拡張子/サイズを検証し、`formatValidationError` の文言で表示。
- `onMetadataChange` は **選択中ファイルがあるときのみ** 発火（`previewUrl` のみの場合は発火しない）。
- `statusOverlay` はプレビュー上のオーバーレイ、`containerOverlay` は全体を覆って操作を無効化。

### 2.2 MediaUploader (`src/lib/mediaInputSuite/components/MediaUploader.tsx`)

- `MediaInput` を内包し、`clientUploader` 経由で Firebase Storage にアップロード。
- `uploadPath` を基準に保存先パスを生成。
- 進捗オーバーレイとキャンセルを内蔵。
- `onRegisterPendingUpload` / `onRegisterPendingDelete` を使うと、アップロード完了後や削除時に pending 管理へ通知できる。

### 2.3 MediaPreview (`src/lib/mediaInputSuite/components/MediaPreview.tsx`)

- `detectMediaType` で image/video/unknown を判定。
- `ImagePreview` / `VideoPreview` / `UnsupportedPreview` に振り分け。

---

## 3. 主要フック

| フック | 役割 | 備考 |
| --- | --- | --- |
| `useImageMetadata` / `useVideoMetadata` | 画像/動画のメタデータ取得 | `handleImageLoad` / `handleVideoMetadata` を渡して使用 |
| `useDragAndDrop` | ドラッグ＆ドロップのイベント補助 | `eventHandlers` と `isDragging` を返す |
| `useMediaMetadataBinding` | メタデータを RHF フィールドへ自動反映 | `SelectedMediaMetadata` を受け取り `setValue` |
| `useMediaMetadataActions` | メタデータ値ごとの任意アクション | 取得失敗時は `null` を通知 |
| `useMediaUploaderField` | RHF と `ControlledMediaUploader` のブリッジ | `render` / `isUploading` / `commit` / `reset` を返す |
| `usePendingMediaUploads` | pending upload の登録/確定/掃除 | `cleanupOnUnmount` 既定 `true` |
| `usePendingMediaDeletion` | pending delete の登録/確定/取消 | `commit` で実削除 |
| `useMockUploader` | デモ/検証用の擬似アップロード | 進捗・エラーを擬似再現 |

### `useMediaUploaderField` の挙動

- `commit()` は **pending upload の確定 + pending delete の実行 + pending upload の cleanup** をまとめて行う。
- `reset()` は pending を破棄し、元の URL に戻す。

---

## 4. フォーム連携（別フォルダの関連）

- `src/components/Form/MediaHandler`
  - `ControlledMediaUploader` / `ControlledMediaInput`（RHF 連携）
  - `ManualMediaUploader` / `ManualMediaInput`（手動 state 連携）
- `src/components/Form/FieldRenderer`
  - `FieldRenderer` が `mediaUploader` タイプのフィールドを自動処理

### 4.1 FieldRenderer でメディアフィールドを扱う例

```tsx
import type { FieldPath } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig, MediaFieldConfig } from "@/components/Form/Field";
import { useMediaMetadataBinding } from "@/lib/mediaInputSuite";
import domainConfig from "@/features/foo/domain.json";

export function FooFields({ methods, onMediaStateChange }) {
  const baseFields = (domainConfig.fields ?? []) as FieldConfig[];
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

---

## 5. 典型的な使い分け

1. **プレビューとメタデータ取得だけ**
   - `MediaInput` + `onMetadataChange`
   - もしくは `MediaPreview` + `useImageMetadata` / `useVideoMetadata`

2. **アップロードを伴うフォーム**
   - `MediaUploader`（素の state 管理）
   - RHF なら `ControlledMediaUploader` or `useMediaUploaderField`

3. **FieldRenderer で自動生成フォーム**
   - `FieldRenderer` + `baseFields`（domain.json から読み込み）

---

## 6. 注意点

- `onMetadataChange` は選択中ファイルのみ対象。既存 URL のみの場合は発火しない。
- `usePendingMediaUploads` は unmount 時に自動 cleanup が既定。長寿命フォームでは `cleanupOnUnmount: false` を検討。
- MIME/拡張子/サイズの制御は `validationRule` と `formatValidationError` に集約。
