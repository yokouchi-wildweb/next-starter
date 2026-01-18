# 汎用コンポーネントで構築するフォーム実装ガイド

このドキュメントは `src/components/Form` の汎用フォーム部品を使って、ドメイン固有のフォームを効率よく組み立てるための指針をまとめたものです。`domain-config` の生成テンプレート（`DomainFieldRenderer` 前提）にも合わせています。

MediaInputSuite の詳細は別ドキュメントに移動しています。
- `src/lib/mediaInputSuite/README.md`

---

## 1. 主要コンポーネントの役割

| レイヤー | 役割 | 代表ファイル |
| --- | --- | --- |
| フォームラッパー | `FormProvider` + `<form>` を統合 | `src/components/Form/AppForm.tsx` |
| 入力アイテム | ラベル/入力/エラー表示を統合 | `src/components/Form/Field/FieldItem.tsx` |
| 入力コンポーネント | Controlled/Manual の入力群 | `src/components/Form/Controlled/*`, `src/components/Form/Manual/*` |
| ドメイン統合 | `domain.json` からフォームを構築 | `src/components/Form/DomainFieldRenderer/*` |
| メディア連携 | RHF/手動の Media 入力ラッパー | `src/components/Form/MediaHandler/*` |

---

## 2. フォーム全体のパターン

1. `useForm` で `UseFormReturn<T>` を作成し、`AppForm` に渡す。
2. `__Domain__Fields` のようなフィールド集合コンポーネントを作成し、`DomainFieldRenderer` を呼ぶ。
3. `DomainFieldRenderer` が `domainJsonFields` と `fields` を統合して `FieldItem` を描画する。
4. メディアフィールドがある場合、`onMediaStateChange` で `DomainMediaState` を受け取り、送信/キャンセル時に `commitAll` / `resetAll` を呼ぶ。

> 旧構成（`ImageUploaderField` + `_partial`）は廃止済みです。`DomainFieldRenderer` + `MediaHandler` を利用してください。

---

## 3. DomainFieldRenderer の使い方

### 主な props

- `methods`: `useForm` の戻り値
- `control`: `methods.control`（省略可）
- `domainJsonFields`: `domain.json` の `fields` 配列
- `fields`: 追加/上書きする `DomainFieldRenderConfig[]`
- `onMediaStateChange`: メディアアップロードの状態通知

### 追加フィールドの例

```tsx
const relationFieldConfigs = useMemo<DomainFieldRenderConfig<FormValues, FieldPath<FormValues>>[]>(
  () => [
    {
      type: "select",
      name: "category_id" as FieldPath<FormValues>,
      label: "カテゴリ",
      options: categoryOptions,
    },
    {
      type: "checkGroup",
      name: "tag_ids" as FieldPath<FormValues>,
      label: "タグ",
      options: tagOptions,
    },
  ],
  [categoryOptions, tagOptions],
);
```

### Media 状態の制御例

```tsx
const [mediaState, setMediaState] = useState<DomainMediaState | null>(null);

const handleSubmit = async (data: FormValues) => {
  await onSubmitAction(data);
  await mediaState?.commitAll();
};

const handleCancel = async () => {
  await mediaState?.resetAll();
  onCancel?.();
};

<DomainFieldRenderer
  methods={methods}
  fields={relationFieldConfigs}
  domainJsonFields={domainConfig.fields ?? []}
  onMediaStateChange={setMediaState}
/>
```

---

## 4. MediaInputSuite との関係

- `DomainFieldRenderer` の `mediaUploader` フィールドは内部で `useMediaUploaderField` を利用します。
- RHF 連携したい場合は `MediaHandler` の `ControlledMediaUploader` / `ControlledMediaInput` を利用します。
- 手動で状態管理する場合は `ManualMediaUploader` / `ManualMediaInput` を利用します。

詳細は以下を参照してください。
- `src/lib/mediaInputSuite/README.md`

---

## 5. Tips

- `fields` で `domainFieldIndex` を指定すると、`domain.json` 側の並びを上書きできます。
- `DomainFieldRenderer` の前後に `FieldItem` を足す構成も可能です。
- 送信中の無効化は `AppForm` の `pending` / `disableWhilePending` を活用してください。
