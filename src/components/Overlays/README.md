# Overlays コンポーネント

画面上にオーバーレイ表示するコンポーネント群。

---

## コンポーネント階層

```
DialogPrimitives (低レベル部品)
    ├── Dialog (確認用)
    └── Modal (汎用)
         ├── TabbedModal (タブ付き)
         └── DetailModal (詳細表示)
```

---

## Dialog / Modal の使い分け

| コンポーネント | 用途 | 特徴 |
|---------------|------|------|
| **Dialog** | 端的な確認 | テキスト + 確認/キャンセルボタン |
| **Modal** | 複雑な情報表示 | 自由度が高い、フォームや詳細表示など |

---

## 各コンポーネントの説明

### Dialog

端的な確認を行うためのダイアログ。「削除しますか？」などの確認に使用。

```tsx
import { Dialog } from "@/components/Overlays/Dialog";

// 基本的な確認ダイアログ
<Dialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="削除の確認"
  description="この操作は取り消せません。本当に削除しますか？"
  confirmLabel="削除"
  cancelLabel="キャンセル"
  onConfirm={handleDelete}
  confirmVariant="destructive"
/>

// アラート型（OKボタンのみ）
<Dialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="完了"
  titleVariant="primary"
  titleAlign="center"
  description="処理が完了しました"
  descriptionAlign="center"
  showCancelButton={false}
  confirmLabel="OK"
  confirmVariant="default"
  footerAlign="center"
/>
```

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` | `boolean` | - | 表示状態 |
| `onOpenChange` | `(open: boolean) => void` | - | 状態変更コールバック |
| `title` | `ReactNode` | - | タイトル |
| `titleVariant` | `TextVariant` | `"default"` | タイトルのスタイル |
| `titleAlign` | `TextAlign` | `"left"` | タイトルの配置 |
| `description` | `ReactNode` | - | 説明文 |
| `descriptionVariant` | `TextVariant` | `"default"` | 説明文のスタイル |
| `descriptionAlign` | `TextAlign` | `"left"` | 説明文の配置 |
| `children` | `ReactNode` | - | 複雑なコンテンツ用。指定時は `description` より優先される。 |
| `layer` | `DialogContentLayer` | `"modal"` | コンテンツのレイヤー（`modal`/`alert`/`super`/`ultimate`/`apex`） |
| `overlayLayer` | `DialogOverlayLayer` | `"modal"` | オーバーレイのレイヤー（`backdrop`/`modal`/`overlay`/`alert`/`super`/`ultimate`/`apex`） |
| `footerAlign` | `TextAlign` | `"right"` | フッター（ボタン）の配置 |
| `showCancelButton` | `boolean` | `true` | キャンセルボタンの表示 |
| `showConfirmButton` | `boolean` | `true` | 確認ボタンの表示 |
| `confirmLabel` | `string` | `"OK"` | 確認ボタンのラベル |
| `cancelLabel` | `string` | `"Cancel"` | キャンセルボタンのラベル |
| `onConfirm` | `() => void \| Promise<void>` | - | 確認時のコールバック |
| `confirmDisabled` | `boolean` | - | 確認ボタンの無効化 |
| `confirmVariant` | `ButtonStyleProps["variant"]` | `"primary"` | 確認ボタンのスタイル |
| `cancelVariant` | `ButtonStyleProps["variant"]` | `"outline"` | キャンセルボタンのスタイル |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御 |

**型定義:**

```ts
type TextVariant = "default" | "primary" | "secondary" | "accent" | "sr-only";
type TextAlign = "left" | "center" | "right";
```

---

### Modal

自由度の高い汎用モーダル。フォームや詳細表示など複雑なコンテンツに使用。

```tsx
import Modal from "@/components/Overlays/Modal";

<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="ユーザー編集"
  maxWidth={800}
>
  <UserEditForm />
</Modal>
```

**Props:**
| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` | `boolean` | - | 表示状態 |
| `onOpenChange` | `(open: boolean) => void` | - | 状態変更コールバック |
| `title` | `ReactNode` | - | タイトル |
| `titleSrOnly` | `boolean` | - | タイトルをスクリーンリーダー専用にする |
| `headerContent` | `ReactNode` | - | ヘッダーに追加するコンテンツ |
| `children` | `ReactNode` | - | モーダル本体のコンテンツ |
| `showCloseButton` | `boolean` | `true` | 閉じるボタンの表示 |
| `maxWidth` | `number \| string` | `640` | 最大幅 |
| `className` | `string` | - | コンテナに付与するクラス |
| `minHeight` | `number \| string` | - | 最小高さ（指定すると内部がスクロール領域でラップされる） |
| `maxHeight` | `number \| string` | - | 最大高さ（指定すると内部がスクロール領域でラップされる） |
| `height` | `number \| string` | - | 高さ（指定すると内部がスクロール領域でラップされる） |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御 |

`minHeight` / `maxHeight` / `height` のいずれかを指定すると、コンテンツは自動的にスクロール可能なラッパーで包まれる。

**onCloseAutoFocus の使用例:**

```tsx
// 閉じた後に特定の入力欄にフォーカスを移す
const searchInputRef = useRef<HTMLInputElement>(null);

<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="検索フィルター"
  onCloseAutoFocus={(e) => {
    e.preventDefault(); // デフォルトのフォーカス動作を無効化
    searchInputRef.current?.focus();
  }}
>
  {/* コンテンツ */}
</Modal>
```

---

### TabbedModal

タブ切り替え機能付きモーダル。Modal を拡張。

```tsx
import TabbedModal from "@/components/Overlays/TabbedModal";

<TabbedModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="設定"
  tabs={[
    { value: "general", label: "一般", content: <GeneralSettings /> },
    { value: "advanced", label: "詳細", content: <AdvancedSettings /> },
  ]}
/>
```

**Props（Modal の props も継承）:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `tabs` | `TabbedModalTab[]` | - | `{ value, label, content, disabled?, forceMount?, triggerClassName?, contentClassName? }` の配列 |
| `ariaLabel` | `string` | `"モーダル内のタブ"` | タブリストを囲う nav の aria-label |
| `value` | `string` | - | 制御用の現在タブ |
| `defaultValue` | `string` | `tabs[0].value` | 非制御時の初期タブ |
| `onValueChange` | `(value: string) => void` | - | 制御／非制御共通の変更通知 |
| `tabsClassName` | `string` | - | Tabs.Root に付与するクラス |
| `tabListClassName` | `string` | - | TabsList に付与するクラス |
| `tabTriggerClassName` | `string` | - | 各 TabsTrigger に共通で付与するクラス |
| `tabContentClassName` | `string` | - | TabsContent に共通で付与するクラス |
| `minHeight` | `number \| string` | `360` | コンテンツ部の最小高さ（Modal 経由で適用） |

各タブの `forceMount` を `true` にすると非表示時も DOM を保持し、内部状態がリセットされない。

---

### DetailModal

詳細表示用モーダル。画像/動画 + テーブル形式のデータ表示に特化。

```tsx
import DetailModal from "@/components/Overlays/DetailModal";

<DetailModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="商品詳細"
  badge={{ text: "公開中", colorClass: "bg-green-500" }}
  media={{ type: "image", url: "/product.jpg", alt: "商品画像" }}
  rows={[
    { label: "商品名", value: "サンプル商品" },
    { label: "価格", value: "¥1,000" },
  ]}
  footer={<Button>編集</Button>}
/>
```

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` | `boolean` | - | 表示状態 |
| `onOpenChange` | `(open: boolean) => void` | - | 状態変更コールバック |
| `title` | `string` | - | タイトル |
| `titleSrOnly` | `boolean` | - | タイトルをスクリーンリーダー専用にする |
| `badge` | `{ text: string; colorClass?: string }` | `colorClass: "bg-green-500"` | タイトル横に表示するバッジ |
| `media` | `{ type?: "image" \| "video"; url: string; alt?: string; poster?: string }` | `type: "image"` | メディアプレビュー |
| `rows` | `DetailModalRow[]` | - | `{ label, value }` の配列、または `ReactNode[]` によるカスタム行 |
| `footer` | `ReactNode` | - | テーブル下に任意のフッターを配置 |
| `className` | `string` | - | 追加クラス |

`rows` へ `ReactNode[]` を渡すと、列幅を柔軟に変えたカスタム行を作成できる。

---

### DialogPrimitives

低レベルの部品群。通常は直接使用せず、Dialog や Modal を使用する。
カスタムのオーバーレイUI構築が必要な場合のみ使用。

```tsx
import {
  DialogPrimitives,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/Overlays/DialogPrimitives";

<DialogPrimitives open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>カスタムダイアログ</DialogTitle>
    </DialogHeader>
    {/* 自由なコンテンツ */}
    <DialogFooter>
      {/* カスタムフッター */}
    </DialogFooter>
  </DialogContent>
</DialogPrimitives>
```

**レイヤー管理（z-index）:**
`DialogContent` の `layer` / `overlayLayer` で z-index 階層を制御可能。
- `layer`: `modal` (デフォルト) / `alert` / `super` / `ultimate` / `apex`
- `overlayLayer`: `backdrop` / `modal` / `overlay` / `alert` / `super` / `ultimate` / `apex`

**DialogContent の主な追加 props**
- `showCloseButton`（デフォルト `true`）: 右上の Close ボタンの表示有無
- `maxWidth` / `minHeight` / `maxHeight` / `height`: サイズ調整。数値は `px` として解釈。

---

## その他のオーバーレイ

### ImageViewer

画像のズーム表示機能を提供。

```tsx
import { ImageViewerProvider, ZoomableImage, useImageViewer } from "@/components/Overlays/ImageViewer";

function Example() {
  const { openImage } = useImageViewer();

  return (
    <ImageViewerProvider>
      <ZoomableImage src="/image.jpg" alt="サンプル" />
      <button onClick={() => openImage("/another.jpg", "別の画像")}>
        別の画像を開く
      </button>
    </ImageViewerProvider>
  );
}
```

---

### Toast

トースト通知の表示。`@/lib/toast` ライブラリで提供される。

```tsx
import { GlobalToast, useToast } from "@/lib/toast";

// layout.tsx などでグローバルに配置（1 つだけ）
<GlobalToast />

// 任意のコンポーネントで呼び出し
const { showToast, hideToast } = useToast();
showToast("保存しました", "success");
showToast({
  message: "同期中…",
  variant: "loading",
  mode: "persistent",
  position: "top-center",
});
hideToast();
```

**主なオプション（省略時のデフォルト値）**
- `variant`: `info`（`mode: "persistent"` の場合は `loading`）
- `mode`: `"notification"`（自動消去） / `"persistent"`（手動消去）
- `position`: `"bottom-center"`
- `duration`: `3000` ms（persistent では無視）
- `size`: `"md"`
- `spinning`: `variant === "loading"` または `mode === "persistent"` のとき自動で `true`
- `icon`: プリセット文字列（`success` など）または `ReactNode`
- `layer`: `"alert"`（必要に応じて `super` などへ引き上げる）

---

### Loading

ローディング表示コンポーネント群。

| コンポーネント | 説明 |
|---------------|------|
| `Spinner` | スピナーアイコン |
| `ScreenLoader` | 画面全体またはローカル領域のローディング |
| `GlobalScreenLoader` | グローバルなローディング表示 |
| `RouteTransitionOverlay` | ルート遷移時のローディング |

```tsx
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";

// フルスクリーン
<ScreenLoader mode="fullscreen" message="読み込み中..." />

// ローカル（親要素は position: relative が必要）
<ScreenLoader mode="local" />
```

---

## Popover コンポーネント群

ポップオーバー系のコンポーネント群。モーダルより軽量なオーバーレイUI。

### Popover（基本）

汎用ポップオーバー。他のPopover系コンポーネントの基盤。

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

**Props:**

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

---

### ConfirmPopover

確認用ポップオーバー。削除確認などに使用。

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

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | `"確認"` | タイトル |
| `description` | `ReactNode` | - | 説明文 |
| `confirmLabel` | `string` | `"確認"` | 確認ボタンラベル |
| `cancelLabel` | `string` | `"キャンセル"` | キャンセルボタンラベル |
| `onConfirm` | `() => void \| Promise<void>` | - | 確認コールバック（Promiseで自動ローディング） |
| `confirmVariant` | `ButtonVariant` | `"primary"` | 確認ボタンスタイル |

---

### PromptPopover

入力用ポップオーバー。追跡番号入力などに使用。

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

**Props:**

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

---

### ActionPopover

アクションメニュー用ポップオーバー。

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

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | - | タイトル（省略可） |
| `actions` | `ActionPopoverItem[]` | - | アクションリスト |
| `closeOnAction` | `boolean` | `true` | アクション後に自動で閉じる |

**ActionPopoverItem:**

```ts
type ActionItem = {
  type?: "action";
  label: string;
  icon?: LucideIcon;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "default" | "destructive";
};

type SeparatorItem = { type: "separator" };
```

---

### ChecklistPopover

チェックリスト選択用ポップオーバー。タグ選択、カテゴリ割り当てなどに使用。

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

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | トリガー要素 |
| `title` | `ReactNode` | - | タイトル |
| `description` | `ReactNode` | - | 説明文 |
| `options` | `ChecklistOption[]` | - | 選択肢リスト |
| `value` | `string[]` | `[]` | 現在の選択値 |
| `onConfirm` | `(values: string[]) => void \| Promise<void>` | - | 適用時のコールバック |
| `searchable` | `boolean` | `false` | 検索機能を有効にする |
| `showSelectAll` | `boolean` | `false` | 全選択/解除ボタンを表示 |
| `maxSelections` | `number` | - | 最大選択数 |
| `maxListHeight` | `number \| string` | `280` | リストの最大高さ（スクロール） |

**ChecklistOption:**

```ts
type ChecklistOption = {
  value: string;      // 値（一意）
  label: string;      // 表示ラベル
  disabled?: boolean; // 無効化
  description?: string; // 説明文
};
```

---

### InfoPopover

情報・ヘルプ表示用ポップオーバー。

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

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `title` | `ReactNode` | - | タイトル |
| `children` | `ReactNode` | - | コンテンツ |
| `iconType` | `"help" \| "info"` | `"help"` | アイコン種類 |
| `iconSize` | `"sm" \| "md" \| "lg"` | `"md"` | アイコンサイズ |
| `trigger` | `ReactNode` | - | カスタムトリガー |

---

## Tooltip

シンプルなツールチップ。ホバーで短いテキストを表示。

```tsx
import { Tooltip } from "@/components/Overlays/Tooltip";

<Tooltip content="設定を開く">
  <IconButton icon={Settings} />
</Tooltip>

// カスタマイズ
<Tooltip
  content="この操作は取り消せません"
  side="right"
  delayDuration={500}
>
  <Button variant="destructive">削除</Button>
</Tooltip>
```

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `content` | `ReactNode` | - | ツールチップの内容 |
| `children` | `ReactNode` | - | トリガー要素 |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"top"` | 表示位置 |
| `delayDuration` | `number` | `200` | 表示までの遅延（ms） |
| `showArrow` | `boolean` | `true` | 矢印表示 |

---

## HoverCard

ホバープレビュー。リンクやユーザー名にホバーで詳細を表示。

```tsx
import { HoverCard } from "@/components/Overlays/HoverCard";

<HoverCard
  trigger={<Link href="/users/1">@username</Link>}
  openDelay={300}
>
  <UserPreviewCard user={user} />
</HoverCard>
```

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `trigger` | `ReactNode` | - | ホバー対象の要素 |
| `children` | `ReactNode` | - | カードのコンテンツ |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | 表示位置 |
| `size` | `"sm" \| "md" \| "lg" \| "xl" \| "auto"` | `"md"` | サイズ |
| `openDelay` | `number` | `300` | 表示までの遅延（ms） |
| `closeDelay` | `number` | `200` | 非表示までの遅延（ms） |
| `showArrow` | `boolean` | `false` | 矢印表示 |
