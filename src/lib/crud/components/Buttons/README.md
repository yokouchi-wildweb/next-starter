# CRUD Buttons

CRUDボタンコンポーネント群。レコードの操作（更新・削除・複製など）を行うボタン。

## コンポーネント一覧

| コンポーネント | 用途 |
|---|---|
| `EnumFieldButton` | 単一レコードのenumフィールドを変更 |
| `BelongsToFieldButton` | 単一レコードのBelongsToリレーションを変更 |
| `BelongsToManyFieldButton` | 単一レコードのBelongsToManyリレーションを変更 |
| `BulkEnumFieldButton` | 複数レコードのenumフィールドを一括変更 |
| `BulkDeleteButton` | 複数レコードを一括削除 |
| `DeleteButton` | 単一レコードを削除（論理削除） |
| `HardDeleteButton` | 単一レコードを物理削除 |
| `DuplicateButton` | 単一レコードを複製 |
| `EditButton` | 編集ページへ遷移 |
| `CreateButton` | 作成ページへ遷移 |

## 重要: テーブルと併用する場合のミューテーション処理

これらのボタンは内部で`router.refresh()`を呼び出しますが、これはServer Componentsの再レンダリング用です。
**クライアント側で`useSWR`などでデータを取得している場合、キャッシュは自動更新されません。**

### 必須対応

テーブルやリストと併用する場合は、必ず`onSuccess`コールバックでデータを再取得してください。

```tsx
// NG: テーブルの表示が更新されない
<EnumFieldButton
  domain="sample"
  id={item.id}
  field="status"
  currentValue={item.status}
/>

// OK: onSuccessでmutateを呼び出す
const { data, mutate } = useSWR("samples", fetcher);

<EnumFieldButton
  domain="sample"
  id={item.id}
  field="status"
  currentValue={item.status}
  onSuccess={() => mutate()}
/>
```

### Bulkボタンの場合

一括操作ボタンでは、選択解除（`selection.clear`）とデータ再取得の両方を行う必要があります。

```tsx
<RecordSelectionTable
  bulkActions={(selection) => (
    <BulkEnumFieldButton
      domain="sample"
      ids={selection.selectedIds}
      field="status"
      onSuccess={() => {
        mutate();           // データ再取得
        selection.clear();  // 選択解除
      }}
    />
  )}
/>
```

## 使用例

### 単一レコード操作

```tsx
// Enumフィールドの変更
<EnumFieldButton
  domain="sample"
  id={sample.id}
  field="status"
  currentValue={sample.status}
  onSuccess={() => mutate()}
/>

// BelongsToリレーションの変更
<BelongsToFieldButton
  domain="sample"
  id={sample.id}
  relation="sampleCategory"
  currentValue={sample.sample_category_id}
  onSuccess={() => mutate()}
/>

// BelongsToManyリレーションの変更
<BelongsToManyFieldButton
  domain="sample"
  id={sample.id}
  relation="sampleTag"
  currentValue={sample.sample_tag_ids ?? []}
  onSuccess={() => mutate()}
/>
```

### 一括操作（RecordSelectionTableと併用）

```tsx
const { data: items, mutate } = useSWR("items", fetcher);

<RecordSelectionTable
  items={items}
  getKey={(item) => item.id}
  bulkActions={(selection) => (
    <>
      <BulkEnumFieldButton
        domain="sample"
        ids={selection.selectedIds}
        field="status"
        onSuccess={() => {
          mutate();
          selection.clear();
        }}
      />
      <BulkDeleteButton
        domain="sample"
        ids={selection.selectedIds}
        onSuccess={() => {
          mutate();
          selection.clear();
        }}
      />
    </>
  )}
  columns={[...]}
/>
```
