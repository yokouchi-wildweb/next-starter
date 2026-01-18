# EditableGridTableの内部構造とエディター拡張

## 概要

EditableGridTableは、インラインで編集可能なグリッドテーブルを提供するコンポーネントです。2025年12月のリファクタリングにより、551行の単一ファイルから11ファイルのモジュール構成に分割され、保守性と拡張性が大幅に向上しました。

---

## ディレクトリ構成

```
src/lib/tableSuite/EditableGridTable/components/EditableGridCell/
├── index.tsx                       # メインコンポーネント (219行)
├── constants.ts                    # 共通定数
├── types.ts                        # 型定義
├── hooks/
│   └── useEditableCell.ts         # ステート管理カスタムフック
├── editors/                        # エディター型別コンポーネント
│   ├── TextEditor.tsx             # text/number型
│   ├── SelectEditor.tsx           # select型
│   ├── MultiSelectEditor.tsx      # multi-select型
│   ├── DateTimeEditor.tsx         # date/time/datetime型
│   ├── SwitchEditor.tsx           # switch型
│   └── ActionEditor.tsx           # action型
└── display/
    └── CellDisplay.tsx            # 読み取り専用表示ロジック
```

---

## アーキテクチャの特徴

### 1. レイヤー分離

EditableGridCellは以下の責務に分離されています：

| レイヤー | ファイル | 責務 |
|---------|---------|-----|
| **メインコンポーネント** | `index.tsx` | エディタールーティング、統合制御 |
| **ステート管理** | `hooks/useEditableCell.ts` | セル状態、イベントハンドリング |
| **エディター** | `editors/*.tsx` | 入力UI、型別のロジック |
| **表示** | `display/CellDisplay.tsx` | 読み取り専用の値表示 |
| **共通定義** | `constants.ts`, `types.ts` | 定数、型定義 |

### 2. エディター型のマッピング

各エディター型は独立したコンポーネントで実装されています：

```typescript
// メインコンポーネント内のエディタールーター
const renderEditor = () => {
  switch (column.editorType) {
    case "text":
      return <TextEditor {...baseEditorProps} type="text" />;
    case "number":
      return <TextEditor {...baseEditorProps} type="number" inputMode="decimal" />;
    case "select":
      return <SelectEditor {...selectEditorProps} />;
    case "multi-select":
      return <MultiSelectEditor {...selectEditorProps} />;
    case "date":
    case "time":
    case "datetime":
      return <DateTimeEditor {...baseEditorProps} type={column.editorType} />;
    case "switch":
      return <SwitchEditor {...switchEditorProps} />;
    default:
      return <TextEditor {...baseEditorProps} type="text" />;
  }
};
```

### 3. カスタムフックによるステート管理

`useEditableCell.ts`は以下を提供します：

```typescript
const { state, handlers, refs, flags, cellKey } = useEditableCell({
  row, rowKey, column, onValidChange
});

// state: { draftValue, error, isEditing, isActive, popupOpen, ... }
// handlers: { handleCommit, handleCancel, activateCell, ... }
// refs: { inputRef, cellRef }
// flags: { isActionEditor, isReadOnly, isSwitchEditor, ... }
```

---

## エディターの追加方法

新しいエディター型を追加する手順：

### Step 1: 型定義の追加

`src/lib/tableSuite/EditableGridTable/types.ts`にエディター型を追加：

```typescript
export type EditableGridEditorType =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "date"
  | "time"
  | "datetime"
  | "readonly"
  | "switch"
  | "action"
  | "color"      // ← 新規追加例
  | "slider";    // ← 新規追加例
```

### Step 2: エディターコンポーネントの作成

`editors/ColorEditor.tsx`を作成：

```typescript
"use client";

import React from "react";
import { Input } from "@/components/Form/Input/Manual";
import type { BaseEditorProps } from "../types";

export function ColorEditor<T>({
  value,
  placeholder,
  error,
  className,
  inputRef,
  onCommit,
  onCancel,
  onDraftChange,
}: BaseEditorProps<T>) {
  return (
    <Input
      type="color"
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onDraftChange(e.target.value)}
      onBlur={() => onCommit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit();
          inputRef.current?.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      ref={(node) => {
        if (inputRef && "current" in inputRef) {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      }}
      aria-invalid={error ? true : undefined}
    />
  );
}
```

### Step 3: メインコンポーネントへの登録

`index.tsx`のrenderEditor関数にcase文を追加：

```typescript
const renderEditor = () => {
  switch (column.editorType) {
    // 既存のcase文...
    case "color":
      return <ColorEditor {...baseEditorProps} />;
    // ...
  }
};
```

### Step 4: 表示ロジックの追加（必要に応じて）

`display/CellDisplay.tsx`に特殊な表示ロジックを追加：

```typescript
const displayValue = React.useMemo(() => {
  if (column.renderDisplay) {
    return column.renderDisplay(rawValue, row);
  }

  // カラーピッカー用の特殊表示
  if (column.editorType === "color") {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded border"
          style={{ backgroundColor: rawValue as string }}
        />
        <span>{rawValue}</span>
      </div>
    );
  }

  // 既存のロジック...
}, [/* ... */]);
```

---

## 共通Propsの利用

### BaseEditorProps

すべてのエディターで共通して使用されるProps：

```typescript
export type BaseEditorProps<T> = {
  row: T;                           // 行データ
  rowKey: React.Key;                // 行キー
  column: EditableGridColumn<T>;    // カラム定義
  value: string;                    // 現在の入力値
  rawValue: unknown;                // 元の値
  placeholder: string;              // プレースホルダー
  error: string | null;             // エラーメッセージ
  className?: string;               // CSSクラス
  paddingClass: string;             // パディングクラス
  textAlignClass: string;           // テキスト配置クラス
  inputRef: React.RefObject<HTMLInputElement | null>;
  onCommit: (next?: unknown, options?: CommitOptions) => void;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
};
```

### SelectEditorProps

Select/MultiSelect用の追加Props：

```typescript
export type SelectEditorProps<T> = BaseEditorProps<T> & {
  popupOpen: boolean;
  cellKey: string;
  onPopupOpenChange: (open: boolean) => void;
};
```

---

## カスタマイズポイント

### 1. バリデーション

各セルにバリデーションを追加：

```typescript
const columns: EditableGridColumn<SampleData>[] = [
  {
    field: "age",
    header: "年齢",
    editorType: "number",
    validator: (value, row) => {
      const age = Number(value);
      if (age < 0 || age > 150) {
        return "年齢は0〜150の範囲で入力してください";
      }
      return null;
    },
  },
];
```

### 2. カスタム表示

`renderDisplay`でセルの表示をカスタマイズ：

```typescript
{
  field: "status",
  header: "ステータス",
  editorType: "select",
  options: [
    { label: "アクティブ", value: "active" },
    { label: "非アクティブ", value: "inactive" },
  ],
  renderDisplay: (value) => (
    <span className={value === "active" ? "text-green-600" : "text-gray-400"}>
      {value === "active" ? "●" : "○"} {value}
    </span>
  ),
}
```

### 3. Switch型の確認ダイアログ

`onToggleRequest`で変更前に確認：

```typescript
{
  field: "published",
  header: "公開",
  editorType: "switch",
  onToggleRequest: async ({ row, nextValue }) => {
    if (nextValue) {
      return window.confirm(`${row.title}を公開しますか？`);
    }
    return true;
  },
}
```

---

## 定数のカスタマイズ

`constants.ts`で全体の見た目を調整：

```typescript
// 行の高さごとのパディング
export const ROW_HEIGHT_TO_PADDING: Record<string, string> = {
  xs: "py-0",
  sm: "py-0.5",
  md: "py-1",
  lg: "py-1.5",
  xl: "py-2",
};

// 入力フィールドの基本クラス
export const INPUT_BASE_CLASS =
  "w-full rounded-none border-0 bg-transparent px-2.5 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 truncate";
```

---

## パフォーマンス最適化

### 1. メモ化

値計算はuseMemoで最適化されています：

```typescript
const rawValue = React.useMemo(() => readCellValue(row, column), [column, row]);
const baseValue = React.useMemo(() => formatCellValue(row, column), [column, row]);
```

### 2. イベントハンドラーのコールバック化

すべてのイベントハンドラーはuseCallbackで安定化されています。

### 3. 外部クリック検知の最適化

ポップアップエディターの外部クリック検知は、属性ベースで効率的に行われます：

```typescript
const POPUP_ATTR = "data-editable-grid-popup";

// ポップアップ内かどうかの判定
const isEventFromPopup = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(target.closest(`[${POPUP_ATTR}="${cellKey}"]`));
```

---

## トラブルシューティング

### エディターがフォーカスされない

`useEditableCell.ts`のuseEffect内でフォーカス処理を確認：

```typescript
React.useEffect(() => {
  if (isEditing) {
    inputRef.current?.focus();
    inputRef.current?.select?.();
  }
}, [isEditing]);
```

### ポップアップが閉じない

`POPUP_ATTR`属性がポップアップコンテンツに正しく設定されているか確認：

```typescript
<SelectContent {...{ [POPUP_ATTR]: cellKey }}>
  {/* ... */}
</SelectContent>
```

### バリデーションエラーが表示されない

`CellErrorIndicator`がレンダリングされているか確認：

```typescript
{hasError ? <CellErrorIndicator message={state.error ?? ""} /> : null}
```

---

## まとめ

EditableGridCellは、以下の設計原則に基づいてリファクタリングされています：

1. **単一責任の原則**: 各ファイルが明確な責務を持つ
2. **開放閉鎖の原則**: 新しいエディター型の追加が容易
3. **依存性逆転の原則**: カスタムフックとPropsで疎結合
4. **再利用性**: エディターとフックは他のコンポーネントでも利用可能

この構造により、保守性、拡張性、テスト性が大幅に向上し、今後の機能追加やバグ修正が容易になりました。
