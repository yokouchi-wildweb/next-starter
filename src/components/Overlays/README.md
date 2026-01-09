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

### AppToast

トースト通知の表示。

```tsx
import { GlobalAppToast } from "@/components/Overlays/AppToast";
import { useAppToast } from "@/hooks/useAppToast";

// layout.tsx などでグローバルに配置（1 つだけ）
<GlobalAppToast />

// 任意のコンポーネントで呼び出し
const { showAppToast, hideAppToast } = useAppToast();
showAppToast("保存しました", "success");
showAppToast({
  message: "同期中…",
  variant: "loading",
  mode: "persistent",
  position: "top-center",
});
hideAppToast();
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
