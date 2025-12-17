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
| `footerAlign` | `TextAlign` | `"right"` | フッター（ボタン）の配置 |
| `showCancelButton` | `boolean` | `true` | キャンセルボタンの表示 |
| `showConfirmButton` | `boolean` | `true` | 確認ボタンの表示 |
| `confirmLabel` | `string` | `"OK"` | 確認ボタンのラベル |
| `cancelLabel` | `string` | `"Cancel"` | キャンセルボタンのラベル |
| `onConfirm` | `() => void \| Promise<void>` | - | 確認時のコールバック |
| `confirmDisabled` | `boolean` | - | 確認ボタンの無効化 |
| `confirmVariant` | `ButtonVariant` | `"primary"` | 確認ボタンのスタイル |
| `cancelVariant` | `ButtonVariant` | `"outline"` | キャンセルボタンのスタイル |
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
| `minHeight` | `number \| string` | - | 最小高さ |
| `maxHeight` | `number \| string` | - | 最大高さ（スクロール対応） |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御 |

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
- `modal` (デフォルト)
- `alert`
- `super`
- `ultimate`
- `apex`

---

## その他のオーバーレイ

### ImageViewer

画像のズーム表示機能を提供。

```tsx
import { ImageViewerProvider, ZoomableImage, useImageViewer } from "@/components/Overlays/ImageViewer";

// Provider でラップ
<ImageViewerProvider>
  <ZoomableImage src="/image.jpg" alt="サンプル" />
</ImageViewerProvider>
```

---

### AppToast

トースト通知の表示。

```tsx
import { GlobalAppToast } from "@/components/Overlays/AppToast";

// layout.tsx などでグローバルに配置
<GlobalAppToast />
```

---

### Loading

ローディング表示コンポーネント群。

| コンポーネント | 説明 |
|---------------|------|
| `Spinner` | スピナーアイコン |
| `ScreenLoader` | 画面全体またはローカル領域のローディング |
| `GlobalScreenLoader` | グローバルなローディング表示 |
| `RouteTransition` | ルート遷移時のローディング |

```tsx
import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";

// フルスクリーン
<ScreenLoader mode="fullscreen" message="読み込み中..." />

// ローカル（親要素は position: relative が必要）
<ScreenLoader mode="local" />
```
