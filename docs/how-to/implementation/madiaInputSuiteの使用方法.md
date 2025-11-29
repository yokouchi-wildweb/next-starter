# mediaInputSuite 利用ガイド

本ドキュメントは `src/lib/mediaInputSuite` に含まれるコンポーネント/フックの役割と、フォームやドメイン実装での組み合わせ方をまとめたものです。**メタデータ取得 → UI プレビュー → Firebase Storage へのアップロード** までを一貫して扱う際のリファレンスとして活用してください。

---

## 1. ライブラリ全体像

```
MediaInput / MediaUploader
  ├─ MediaPreview (ImagePreview / VideoPreview / UnsupportedPreview)
  ├─ useImageMetadata / useVideoMetadata  … 画像/動画メタ情報の取得
  ├─ useDragAndDrop                         … Drop 操作の吸収
  ├─ useMediaUploaderField                  … RHF + Storage Pending 管理
  ├─ useMediaFieldHandler                   … DomainFieldRenderer への差し込み
  ├─ useMediaMetadataBinding                … メタデータ → RHF フィールド自動反映
  └─ useMediaMetadataActions                … メタデータごとの任意アクション実行
```

- **MediaInput**: 単純なファイル選択コンポーネント。プレビュー表示やバリデーション、`onMetadataChange` などのイベントを提供。
- **MediaUploader**: `MediaInput` を内包し、`clientUploader` を通じて Firebase Storage へアップロード。進捗オーバーレイやキャンセル、アップロード済み URL の管理も含む。
- **MediaPreview 系**: ファイル/URL から自動判定して画像・動画のプレビューを描画。`detectMediaType` を利用。
- **Storage Pending 管理**: `usePendingMediaUploads` / `usePendingMediaDeletion` がアップロードしたが確定していないファイルの削除やコミットを担う。

---

## 2. 主要コンポーネント

### 2.1 MediaInput (`src/lib/mediaInputSuite/components/MediaInput.tsx`)
- `onFileChange`, `onMetadataChange`, `previewUrl` などを props として受け、ドラッグ＆ドロップや選択済ファイルのプレビューを提供。
- `validationRule`（MIME/拡張子/サイズ）を指定すると `validateFile` を通じて即時バリデーション。
- `statusOverlay` / `containerOverlay` を渡すことでアップロード中オーバーレイなどを差し込める。

### 2.2 MediaUploader (`components/MediaUploader.tsx`)
- `uploadPath` を基に Firebase Storage にアップロード。成功時は `onUrlChange` でダウンロード URL を返す。
- 進捗（`UploadProgress`）を表示し、`PseudoButton` でキャンセル可能。
- `onRegisterPendingUpload` / `onRegisterPendingDelete` を通じて pending cleanup を連携できる。

### 2.3 MediaPreview / ImagePreview / VideoPreview
- `detectMediaType` でファイルタイプを判定し、適切なプレビューを描画。
- `ImagePreview`/`VideoPreview` は `onLoad` / `onLoadedMetadata` を受け取れるため、外部でメタデータを処理したい場合にも利用可能。

---

## 3. メタデータ関連フック

| フック名 | 役割 | 典型的な使い方 |
| --- | --- | --- |
| `useImageMetadata` / `useVideoMetadata` | `MediaInput` 等から発火するイベントで画像/動画のメタ情報を組み立てる | `onLoad` / `onLoadedMetadata` に渡し、`metadata` state として利用 |
| `useMediaMetadataBinding` | メタデータ値を React Hook Form の任意フィールドへ自動セット | `{ sizeBytes: "filesize" }` のようにマッピングして `onMetadataChange` に渡す |
| `useMediaMetadataActions` | メタデータ項目ごとに任意のアクションを実行 | 例: `durationSec` をカスタムロジックへ渡す、ログ出力など |
| `useMediaFieldHandler` | `domain.json` で定義された `media` フィールドに追加ハンドラを差し込むためのヘルパー | `useMediaMetadataBinding` の戻り値や独自関数を `onMetadataChange` として注入 |
| `useMediaUploaderField` | `react-hook-form` と MediaUploader を繋ぎ、pending アップロード/削除の管理を行う | `DomainFieldRenderer` 以外のコンポーネントでメディアフィールドを制御したいときに利用 |

`useMediaMetadataBinding` と `useMediaMetadataActions` は排他利用を想定しています。前者は RHF フィールドへの自動反映、後者は任意の副作用処理を組み込みたい場合に使用してください。

---

## 4. DomainFieldRenderer との統合パターン

### 4.1 media フィールドにカスタムハンドラを差し込む

1. `domain.json` 側では通常どおり `media` フィールドを定義。
2. UI レイヤーで `useMediaFieldHandler` を呼ぶ。

```tsx
const handleMetadata = useMediaMetadataBinding({
  methods,
  binding: { sizeBytes: "filesize" as FieldPath<FooCreateFields> },
});

const { customFields, filteredDomainJsonFields } = useMediaFieldHandler({
  domainFields: domainConfig.fields,
  targetFieldName: "media",
  baseFields: relationFieldConfigs,
  onMetadataChange: handleMetadata,
});

return (
  <DomainFieldRenderer
    methods={methods}
    fields={customFields}
    domainJsonFields={filteredDomainJsonFields}
  />
);
```

- `useMediaFieldHandler` は内部で `useCustomField` を利用し、指定した `targetFieldName` を `domainJsonFields` から除外して `fields` 側へカスタム設定を追加します。
- `onMetadataChange` には `useMediaMetadataBinding` や `useMediaMetadataActions` の戻り値を渡せます。

### 4.2 `useMediaUploaderField` を使うパターン

- `ControlledMediaUploader` を React Hook Form と直接連携したい場合に利用。
- `usePendingMediaUploads` / `usePendingMediaDeletion` を内部で呼び、`commit` / `reset` を提供します。
- `DomainFieldRenderer` ではなく任意のフォームコンポーネント内でメディア入力を制御したいケース向け。

---

## 5. 典型的な処理フロー

1. **プレビューとメタデータ取得のみ**
   - `MediaInput` + `useImageMetadata`/`useVideoMetadata`。
   - `onMetadataChange` で `SelectedMediaMetadata` を受け取り、必要があれば `useMediaMetadataActions` でロジックを実行。

2. **アップロードを伴うフォーム**
   - `MediaUploader` を使用し、`onUrlChange` で Storage URL をフォーム値へセット。
   - RHF を使うなら `ControlledMediaUploader` や `useMediaUploaderField` を採用。
   - Pending ファイルの管理が必要であれば `usePendingMediaUploads` / `usePendingMediaDeletion` を組み合わせる。

3. **DomainFieldRenderer で自動生成されたフォーム**
   - `useMediaFieldHandler` + `useMediaMetadataBinding` で Hidden フィールドへファイルサイズや解像度を格納。
   - `metadataBinding` を `{ durationSec: "videoDuration", orientation: "imageOrientation" }` のように増やせば複数項目にも対応可能。

---

## 6. よくあるポイント

- **複数のメディアフィールド**: `useMediaFieldHandler` を複数回呼び出せば `coverImage` / `thumbnail` などフィールドごとに異なるハンドラを差し込めます。
- **バリデーション**: `validationRule` で `maxSizeBytes` や `allowedMimeTypes` を設定すれば、UI で即時エラー表示が可能。`formatValidationError` を利用して文言を統一。
- **アップロードとフォーム送信の同期**: `useMediaUploaderField` や `usePendingMediaUploads` を活用し、フォーム送信成功時に `commit()`、キャンセル時に `cleanup()` を呼ぶことで Storage 側にゴミファイルを残さない運用が可能。
- **メタデータが取得できないケース**: `SelectedMediaMetadata` の `image`/`video` はどちらも null の場合があります。このとき `useMediaMetadataBinding` / `useMediaMetadataActions` は `null` をセット／通知するため、受け取る側で初期化処理を行ってください。

---

## 7. まとめとおすすめの使い分け

| シナリオ | 推奨コンポーネント/フック |
| --- | --- |
| プレビューのみ必要 | `MediaInput` + `MediaPreview` 系 |
| Firebase Storage へアップロードしたい | `MediaUploader` + `usePendingMediaUploads`/`usePendingMediaDeletion` |
| RHF を使うフォーム | `ControlledMediaUploader` または `useMediaUploaderField` |
| DomainFieldRenderer で media フィールドを拡張 | `useMediaFieldHandler` + `useMediaMetadataBinding`（or `useMediaMetadataActions`） |
| メタデータをフォーム値へ自動セット | `useMediaMetadataBinding` |
| メタデータをトリガーに独自処理を行う | `useMediaMetadataActions` |

このガイドを基に、各ドメインで必要な機能だけを組み合わせて活用してください。疑問点があれば `mediaInputSuite` 配下の実装ファイルを参照するか、既存ドメイン（例: Foo ドメイン）の実装を参考にするのがおすすめです。
