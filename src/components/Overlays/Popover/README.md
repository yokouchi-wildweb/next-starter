# Overlays/Popover

## Overview

- ポップオーバー系のコンポーネント群。モーダルより軽量なオーバーレイ UI。入口は `@/components/Overlays/Popover`
- 使う時・直す時の決まりは札 .claude/rules/items/components/Overlays.mdにある
- 部品: Popover(基本)・ConfirmPopover(確認)・PromptPopover(入力)・ActionPopover(アクションメニュー)・ChecklistPopover(静的な選択肢からの複数選択)・InfoPopover(情報・ヘルプ)・SelectPopover(単一選択)・PopoverAsyncContent(非同期の中身の包み)

## Usage

### Popover(基本)

- 汎用ポップオーバー。他の Popover 系コンポーネントの基盤

```tsx
import { Popover } from "@/components/Overlays/Popover";

<Popover
  trigger={<Button>開く</Button>}
  title="設定"
  description="表示設定を変更します"
  showArrow
  showClose
>
  <p>コンテンツ...</p>
</Popover>
```

### ConfirmPopover

- 確認用ポップオーバー。削除確認などに使用

```tsx
import { ConfirmPopover } from "@/components/Overlays/Popover";

<ConfirmPopover
  trigger={<Button variant="destructive">削除</Button>}
  title="削除しますか？"
  description="この操作は取り消せません"
  onConfirm={handleDelete}
  confirmVariant="destructive"
/>
```

### PromptPopover

- 入力用ポップオーバー。追跡番号入力などに使用

```tsx
import { PromptPopover } from "@/components/Overlays/Popover";

// 単一行入力
<PromptPopover
  trigger={<Button>追跡番号</Button>}
  title="追跡番号を入力"
  description="配送業者から通知された追跡番号を入力してください"
  placeholder="例: 1234-5678-9012"
  onConfirm={async (value) => {
    await updateTrackingNumber(id, value);
  }}
/>

// 複数行入力
<PromptPopover
  trigger={<Button>メモ</Button>}
  title="メモを追加"
  multiline
  rows={4}
  validation={(v) => v.length > 0 ? null : "入力してください"}
  onConfirm={handleSave}
/>
```

### ActionPopover

- アクションメニュー用ポップオーバー

```tsx
import { ActionPopover } from "@/components/Overlays/Popover";
import { Edit, Copy, Trash } from "lucide-react";

<ActionPopover
  trigger={<IconButton icon={MoreVertical} />}
  actions={[
    { label: "編集", icon: Edit, onClick: handleEdit },
    { label: "複製", icon: Copy, onClick: handleDuplicate },
    { type: "separator" },
    { label: "削除", icon: Trash, onClick: handleDelete, variant: "destructive" },
  ]}
/>
```

### ChecklistPopover

- チェックリスト選択用ポップオーバー。タグ選択、カテゴリ割り当てなどに使用

```tsx
import { ChecklistPopover } from "@/components/Overlays/Popover";

// 基本使用
<ChecklistPopover
  trigger={<Button>タグを選択</Button>}
  title="タグを選択"
  options={[
    { value: "urgent", label: "緊急" },
    { value: "important", label: "重要" },
    { value: "review", label: "レビュー待ち" },
  ]}
  value={selectedTags}
  onConfirm={async (values) => {
    await updateTags(recordId, values);
  }}
/>

// 検索機能と全選択ボタン付き
<ChecklistPopover
  trigger={<Button>カテゴリ</Button>}
  title="カテゴリを選択"
  options={categories}
  value={selectedCategories}
  searchable
  showSelectAll
  maxListHeight={240}
  onConfirm={handleUpdate}
/>
```

#### 新規追加(`onCreateOption`)

- 「追加」を押した時点で作成する。作った選択肢はチェック済みでリスト末尾に入り、適用するまで対象レコードには反映されない。キャンセルしても作った選択肢は残る
- 同じ名前（前後の空白を除いて完全一致）があれば作らず、既存の選択肢を選ぶ。読み込み済みの選択肢だけを見るので、厳密な一意性は作成側が持つ
- `onCreateOption` が throw すると、入力欄の下にエラーを表示し、入力と選択を残す
- キーボード: 入口を押すと入力欄へフォーカスが移る（`autoFocus` ではなく開いた時の effect。jsx-a11y/no-autofocus の対象外）。Enter で追加、Esc は入力欄だけを閉じる（ポップオーバーは閉じない）、追加後は作った行へフォーカスが移る
- `maxSelections` に達している間は入口を無効にする。「すべて削除」がオンの間は入口を出さない
- 次に開いたときの選択肢は親の `options` が正

### InfoPopover

- 情報・ヘルプ表示用ポップオーバー。短いホバーの説明は Tooltip / HelpTip(`../Tooltip/README.md`)

```tsx
import { InfoPopover } from "@/components/Overlays/Popover";

// ?アイコン（デフォルト）
<InfoPopover title="税込価格について">
  消費税10%を含んだ価格です。
  軽減税率対象商品は8%で計算されます。
</InfoPopover>

// infoアイコン
<InfoPopover iconType="info" title="ヒント">
  キーボードショートカット: Cmd + S で保存できます
</InfoPopover>
```

## API

### Popover の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | - | タイトル |
| `description` | `ReactNode` | - | 説明文 |
| `children` | `ReactNode` | - | コンテンツ |
| `footer` | `ReactNode` | - | フッター |
| `size` | `"sm" \| "md" \| "lg" \| "xl" \| "auto"` | `"md"` | サイズ |
| `showArrow` | `boolean` | `false` | 矢印表示 |
| `showClose` | `boolean` | `false` | 閉じるボタン表示 |
| `open` | `boolean` | - | 制御モード: 開閉状態 |
| `onOpenChange` | `(open: boolean) => void` | - | 開閉状態変更コールバック |

### ConfirmPopover の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | `"確認"` | タイトル |
| `description` | `ReactNode` | - | 説明文 |
| `confirmLabel` | `string` | `"確認"` | 確認ボタンラベル |
| `cancelLabel` | `string` | `"キャンセル"` | キャンセルボタンラベル |
| `onConfirm` | `() => void \| Promise<void>` | - | 確認コールバック（Promiseで自動ローディング） |
| `confirmVariant` | `ButtonStyleProps["variant"]` | `"primary"` | 確認ボタンスタイル |

### PromptPopover の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | - | タイトル |
| `description` | `ReactNode` | - | 説明文 |
| `placeholder` | `string` | - | プレースホルダー |
| `defaultValue` | `string` | `""` | 初期値 |
| `multiline` | `boolean` | `false` | 複数行入力（textarea） |
| `rows` | `number` | `3` | textareaの行数 |
| `inputType` | `"text" \| "number" \| "email" \| "tel" \| "url"` | `"text"` | 入力タイプ |
| `validation` | `(value: string) => string \| null` | - | バリデーション関数 |
| `onConfirm` | `(value: string) => void \| Promise<void>` | - | 確認コールバック |

### ActionPopover の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | - | タイトル（省略可） |
| `actions` | `ActionPopoverItem[]` | - | アクションリスト |
| `closeOnAction` | `boolean` | `true` | アクション後に自動で閉じる |

ActionPopoverItem:

```ts
type ActionItem = {
  type?: "action";
  label: string;
  description?: string;
  icon?: LucideIcon;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "default" | "destructive";
};

type SeparatorItem = { type: "separator" };
```

### ChecklistPopover の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | - | タイトル |
| `description` | `ReactNode` | - | 説明文 |
| `options` | `ChecklistOption[]` | - | 選択肢リスト |
| `value` | `string[]` | `[]` | 現在の選択値 |
| `onConfirm` | `(values: string[]) => void \| boolean \| Promise<void \| boolean>` | - | 適用時のコールバック。`false` を返すと閉じず、選択を残す |
| `searchable` | `boolean` | `false` | 検索機能を有効にする |
| `showSelectAll` | `boolean` | `false` | 全選択/解除ボタンを表示 |
| `maxSelections` | `number` | - | 最大選択数 |
| `maxListHeight` | `number \| string` | `330` | リストの最大高さ（スクロール） |
| `modal` | `boolean` | `false` | モーダルとして開く。背面のスクロールと操作を止め、外側のクリックで閉じる。自身のリストはスクロールできる |
| `onCreateOption` | `(name: string) => Promise<ChecklistOption>` | - | 指定すると検索欄とは別に「新規追加」の入口を表示する |
| `createOptionLabel` | `string` | `"新規追加"` | 入口のラベル |
| `createOptionPlaceholder` | `string` | `"名前を入力"` | 入力欄のプレースホルダー |
| `createOptionErrorMessage` | `string` | `"追加に失敗しました"` | 作成失敗時の既定メッセージ |

ChecklistOption:

```ts
type ChecklistOption = {
  value: string;      // 値（一意）
  label: string;      // 表示ラベル
  disabled?: boolean; // 無効化
  description?: string; // 説明文
};
```

### InfoPopover の props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `title` | `ReactNode` | - | タイトル |
| `children` | `ReactNode` | - | コンテンツ |
| `iconType` | `"help" \| "info"` | `"help"` | アイコン種類 |
| `iconSize` | `"sm" \| "md" \| "lg"` | `"md"` | アイコンサイズ |
| `trigger` | `ReactNode` | - | カスタムトリガー |

## Internals

### 高さ(PopoverContent 共通)

- Radix が算出する配置側のビューポート残り高さ（`--radix-popover-content-available-height`）を上限とし、超える場合は内側のラッパーだけがスクロールする。長いリスト + フッターのポップオーバーでも確定ボタンが画面外に出ることはない。矢印（`showArrow`）はこの上限の外側に描画される。HoverCard も同じ構造。

### 内側にスクロールリストを持つ中身(ピッカー系)

- 上限を超えると外側ラッパーと内側リストの両方がスクロールし、二重スクロールになる。中身のルートに同じ上限(`PICKER_POPOVER_BODY_CLASS` = available-height − 枠線 2px)を付け、flex-col + `min-h-0` のチェーンでリストだけを縮める(`Input/AsyncOptionSource/popoverSide.ts`。ComboboxInput / AsyncComboboxInput / MultiSelectInput / AsyncMultiSelectInput が使用)
- 上限は配置側の残り高さなので、開いた直後に中身が短い(読み込み中など)と Radix の flip は二度と働かない。これらのピッカーは開く瞬間にトリガーの上下の空きを測って `side` を決める(`usePickerPopoverSide`、テスト `pnpm test src/components/Input/AsyncOptionSource/popoverSide.test.mjs`)。`popoverContentProps.side` を渡せばそちらが優先される

### Dialog / Modal 内での外側判定(PopoverContent 共通)

- 外側クリックで閉じる標準 UX は維持しつつ、次の 2 つだけは閉じない: (1) Dialog 自身の dismiss chrome(オーバーレイ / 閉じるボタン)への操作(`preventLayerDismiss`、既定 true) | (2) Dialog の FocusScope がコンテナ自身へプログラム的に focus を戻した `focusin`(常時)
- (2) が無いと、Popover 内のボタンが「クリック → `disabled` + スピナー差し替え」でフォーカスを失った瞬間に Radix が DialogContent へ focus し、処理中の Popover が勝手に閉じる(非同期の確定ボタン全般で再現)
- 判定は `src/components/Primitives/Popover/isDialogFocusRestoration.ts`(純粋関数、`pnpm test src/components/Primitives/Popover/isDialogFocusRestoration.test.mjs`)。空のモーダル本体クリックは pointerdown 側で従来どおり閉じる

### ActionPopover の読み込み中

- `onClick` が Promise を返すと、終わるまでその項目だけが押せなくなり、項目のアイコンが回り(`animate-spin`)、文字が「処理中...」になる(アイコンの無い項目は文字だけ)。他の項目は押せるまま。成功すると `closeOnAction` に従って閉じ、失敗(reject)したときは開いたまま読み込み中だけが解ける

### ChecklistPopover の状態

開いている最中に親が再レンダーして `value` の配列参照が変わっても、選択途中の状態と検索文字列は保持される（リセットは open の false→true 遷移時のみ）。

### フォーカス

- `PopoverContent` の props をそのまま透過しているので、`onOpenAutoFocus` / `onCloseAutoFocus` を渡せる(使い方は `../README.md` Usage「onOpenAutoFocus / onCloseAutoFocus」)
