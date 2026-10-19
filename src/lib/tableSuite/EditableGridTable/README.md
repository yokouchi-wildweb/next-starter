# EditableGridTable（内部構造とエディター拡張）

インライン編集できるグリッドテーブル。基本的な使い方・共通 Props（スタイリング / ソート / 並び替え / headerHelp）は [tableSuite README](../README.md) を参照。
ここではセル（`EditableGridCell`）の内部構造と、カラム定義のカスタマイズ、新しいエディター型の追加手順をまとめる。

## ディレクトリ構成

```
EditableGridTable/
├── index.tsx                         # テーブル本体（ヘッダー・行・onCellChange への橋渡し）
├── types.ts                          # EditableGridEditorType / EditableGridColumn / Props 型
├── utils/value.ts                    # readCellValue / formatCellValue / parseCellValue（editorType 別の整形・解釈）
└── components/
    ├── CellErrorIndicator.tsx        # バリデーションエラー表示
    └── EditableGridCell/
        ├── index.tsx                 # セル本体（エディター振り分け・統合制御）
        ├── constants.ts              # INPUT_BASE_CLASS / DISPLAY_BASE_CLASS / POPUP_ATTR / CLEAR_VALUE
        ├── types.ts                  # セル内部ステート・ハンドラー・エディター Props 型
        ├── hooks/useEditableCell.ts  # セル状態・イベント処理
        ├── editors/                  # editorType 別の入力 UI
        │   ├── TextEditor.tsx        # text / number
        │   ├── SelectEditor.tsx      # select
        │   ├── MultiSelectEditor.tsx # multi-select
        │   ├── DateTimeEditor.tsx    # date / time / datetime
        │   ├── SwitchEditor.tsx      # switch
        │   └── ActionEditor.tsx      # action（renderAction の描画）
        └── display/CellDisplay.tsx   # 非編集時の値表示
```

## セルの責務分担

| レイヤー | ファイル | 責務 |
|---|---|---|
| セル本体 | `EditableGridCell/index.tsx` | `renderEditor()` による editorType 別の振り分け、表示 / 編集の切替、cellAction オーバーレイ |
| ステート | `hooks/useEditableCell.ts` | draft 値・エラー・編集 / アクティブ状態、commit / cancel、外部クリック検知、編集開始時のフォーカス |
| エディター | `editors/*.tsx` | 入力 UI。`onDraftChange` で下書き、`onCommit` / `onCancel` で確定・取消 |
| 表示 | `display/CellDisplay.tsx` | 非編集時の表示（`renderDisplay` 優先、select / multi-select はラベル解決） |
| 値変換 | `utils/value.ts` | 表示用整形（`formatValue` 優先）と保存用解釈（`parseValue` 優先） |

`useEditableCell` は `{ state, handlers, refs, flags, cellKey }` を返す。

- `state`: `draftValue` / `multiDraftValue` / `error` / `isEditing` / `isActive` / `popupOpen`
- `handlers`: `handleCommit` / `handleCancel` / `activateCell` / `handleSingleClick` / `handleDoubleClick` / `handleSwitchToggle` / `handleMultiSelectChange` と各 setter
- `refs`: `inputRef` / `cellRef`
- `flags`: `isActionEditor` / `isReadOnly`（`readonly` と `action` は読み取り専用扱い）/ `isSwitchEditor` / `isMultiSelectEditor`
- `cellKey`: `${rowKey}-${field}`

### 確定の流れ

`handleCommit(next?, options?)` は、値が無変更（引数なし かつ draft なし）なら編集終了のみ。
変更があれば `parseCellValue`（`column.parseValue` 優先）→ `column.validator` の順に通し、エラーならセルに表示して編集を継続、
通れば `onValidChange` → テーブルの `onCellChange({ rowKey, field, value, row })` が呼ばれる。
`options.keepEditing` で編集継続、`options.skipDraftReset` で draft を保持する。

### ポップアップの外部クリック判定

Select 系のポップアップはセルの DOM 外に描画されるため、ポップアップ側に `POPUP_ATTR`（`data-editable-grid-popup`）= `cellKey` を付け、
`useEditableCell` の外部クリック検知で `closest('[data-editable-grid-popup="<cellKey>"]')` に当たるものはセル内扱いにしている。
ポップアップを持つエディターを追加する場合は、ポップアップのルート要素に `{ [POPUP_ATTR]: cellKey }` を必ず付ける（付け忘れると開いた瞬間に編集が閉じる）。

## カラム定義のカスタマイズ

```ts
const columns: EditableGridColumn<Item>[] = [
  {
    field: "age",
    header: "年齢",
    editorType: "number",
    // 確定前の検証。文字列を返すとエラー表示して確定しない
    validator: (value) => {
      const age = Number(value);
      return age < 0 || age > 150 ? "年齢は0〜150の範囲で入力してください" : null;
    },
  },
  {
    field: "published",
    header: "公開",
    editorType: "switch",
    // 切替前の確認。false（または false に解決される Promise）で切替を中止
    onToggleRequest: async ({ row, nextValue }) => (nextValue ? confirmPublish(row) : true),
  },
  {
    field: "status",
    header: "ステータス",
    editorType: "select",
    options: statusOptions,
    // 非編集時の表示を差し替え
    renderDisplay: (value) => <StatusBadge status={value as string} />,
  },
];
```

その他のカラムオプション: `getValue`（行からの値取得）/ `formatValue`（表示用文字列）/ `parseValue`（入力値 → 保存値）/
`allowNullSelection` + `nullOptionLabel`（select の未選択肢）/ `renderAction`（`action` 型の操作部品）/
`cellAction`（`readonly` 型のみ有効。他の型に付けると開発時に console.warn）/ `paddingX` / `paddingY` / `align` / `width` / `placeholder`。

## エディター型を追加する

editorType は公開型なので、追加は tableSuite 全体への機能追加として扱う。

1. **型**: `EditableGridTable/types.ts` の `EditableGridEditorType` に値を追加する（tableSuite README の editorType 一覧も更新）
2. **エディター**: `editors/<Name>Editor.tsx` を作る。Props は `BaseEditorProps<T>`（`EditableGridCell/types.ts`）を受け、
   入力変更で `onDraftChange`、確定で `onCommit()`、取消で `onCancel()` を呼び、`inputRef` を入力要素に接続する。
   入力部品は `TextEditor` と同じく `@/components/Form/Input/Manual` の wrapper を使う（`_shadcn` 直接 import 禁止）。
   ポップアップを持つ場合は `SelectEditorProps<T>`（`popupOpen` / `cellKey` / `onPopupOpenChange`）を受け、上記 `POPUP_ATTR` を付ける
3. **振り分け**: `EditableGridCell/index.tsx` の `renderEditor()` に case を追加する（未知の型は `default` で text 扱い）
4. **値変換（必要なら）**: `utils/value.ts` の `formatByType` / `parseByType` に型別の整形・解釈を追加する
5. **表示（必要なら）**: `display/CellDisplay.tsx` に型別の表示分岐を追加する（`column.renderDisplay` が常に優先される）

## トラブルシューティング

- **編集開始時にフォーカスされない**: エディターが `inputRef` を入力要素に接続しているか確認する（`useEditableCell` は `isEditing` が true になると `inputRef.current?.focus()` / `select()` を呼ぶ）
- **ポップアップを操作すると編集が閉じる / 閉じない**: ポップアップのルート要素に `{ [POPUP_ATTR]: cellKey }` が付いているか確認する
- **バリデーションエラーが出ない**: `validator` は `parseValue` 後の値を受け取る。number 型なら解釈後の値で判定しているか確認する
