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
| **Modal `scrollable={false}`** | タブ + 内部テーブル等の固定高モーダル | 本体はスクロールせず、内側の指定領域だけがスクロールする |

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
| `description` | `ReactNode` | - | 説明文（`aria-describedby` の対象）。`children` と併用可。ヘッダ内で title の直下に描画される |
| `descriptionVariant` | `TextVariant` | `"default"` | 説明文のスタイル |
| `descriptionAlign` | `TextAlign` | `"left"` | 説明文の配置 |
| `children` | `ReactNode` | - | 複雑なコンテンツ用。本体（スクロール領域）に描画される |
| `showCloseButton` | `boolean` | `false` | 右上の ✕ ボタン。`showCancelButton` / `showConfirmButton` を両方 false にする場合は必ず true にして閉じ手段を残す |
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

**高さ:** 箱は Modal と同じ `max-h-[calc(100dvh-2rem)]` で上限され、長い `children` は本体だけがスクロールする（title / description / ボタン列は常に箱内）。`title` 省略時も sr-only の既定タイトルが入り、`role="dialog"` のアクセシブルネームが欠けることはない。

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
| `title` | `ReactNode` | - | タイトル。省略時は sr-only の既定タイトル（「ダイアログ」）が入る（Radix の DialogTitle 必須要件 + アクセシブルネーム確保） |
| `titleSrOnly` | `boolean` | - | タイトルをスクリーンリーダー専用にする |
| `headerContent` | `ReactNode` | - | ヘッダーに追加するコンテンツ |
| `children` | `ReactNode` | - | モーダル本体のコンテンツ |
| `footer` | `ReactNode` | - | スクロール領域の外側に描画される常時表示フッター（アクションバー）。区切り線・余白は Modal 側が持つ |
| `confirmOnClose` | `ModalConfirmOnClose` | - | `{ enabled, title?, message?, confirmLabel?, cancelLabel? }`。enabled が true の間、閉じ操作を確認ダイアログで遮る |
| `showCloseButton` | `boolean` | `true` | 閉じるボタンの表示 |
| `maxWidth` | `number \| string` | `640` | 最大幅 |
| `className` | `string` | - | コンテナに付与するクラス |
| `minHeight` | `number \| string` | - | 本体の最小高さ（短い内容でも高さが揺れないための床）。指定すると内部がスクロール領域でラップされる。箱の上限に当たる場合は床より優先して縮む（下記「高さの仕組み」） |
| `maxHeight` | `number \| string \| null` | `"calc(100dvh - 2rem)"` | 本体の最大高さ。指定するとコンテンツが overflow-y-auto でラップされる。デフォルト値（= 箱の上限）を超える指定は内部でクランプされる。`null` を渡すと制限を解除できる。 |
| `height` | `number \| string` | - | 本体の高さ（指定すると内部がスクロール領域でラップされる）。デフォルト最大高さを超える指定は内部でクランプされる |
| `scrollable` | `boolean` | `true` | `false` で固定高コンテナモード：本体ラッパーがスクロールせず（overflow-clip）、consumer が用意した内側領域だけをスクロールさせる。詳細は下記 |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御 |

デフォルトで `maxHeight` が設定されているため、長いコンテンツは常にビューポート内に収まり内部スクロールされる。タイトル部 (DialogHeader) は固定で、本体だけがスクロールする。デフォルトを無効化したい場合は `maxHeight={null}` を渡す。

**高さの仕組み（単一の真のソース = 箱の上限）:**

モーダルの箱（DialogContent）は `flex-col` + `max-h-[calc(100dvh-2rem)]`。ヘッダ（title + headerContent）と footer は `shrink-0`、本体ラッパーは `min-h-0` の flex 子。箱が上限に達すると**本体ラッパーだけが縮んでスクロール**するため、ヘッダ・タブ列・footer の実高がいくらであっても、close ボタンや footer が箱外・画面外に押し出されることは構造的に起きない。consumer が「クローム分の予算」を計算して `maxHeight` を調整する必要はない。

- `maxHeight` / `height` に既定値（`calc(100dvh - 2rem)`）を超える値（例: `90vh`）を渡しても `min()` でクランプされる。既定値以下の値（`85vh` 等）はそのまま効く。`maxHeight={null}` を渡すとクランプも箱の上限も解除される。
- `minHeight` はラッパーではなく本体内側の要素に付く。短い内容では本体が `minHeight` まで確保され（タブ切替で高さが揺れない）、箱の上限に当たる低いビューポートでは床より優先してラッパーが縮み、内側がスクロールする。
- ❌ 旧実装（grid + 本体に「クローム 6rem 予算」）では grid の auto 行が箱の max-height で縮まず、TabbedModal + footer で本体と footer が箱の外に描画されていた。同種の予算計算を consumer 側で再発明しないこと。

**scrollable（固定高コンテナモード）:**

タブ + 内部テーブルのようなモーダルでは「タブ切替で高さが揺れない」「スクロール領域はちょうど1つ（内側のテーブルだけ）」が必要になる。デフォルトの Modal は「高さ制約 = 本体が overflow-y-auto」なので、内側に独自のスクロール領域を作ると 1px の溢れでも外側スクロールバーが復活して二重スクロールになる。`scrollable={false}` はこの結合を切る：

```tsx
<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="ユーザー管理"
  scrollable={false}
>
  {/* 箱の高さが確定するので h-full / flex-1 で内部レイアウトを組める */}
  <Flex direction="column" className="h-full">
    <FilterBar />
    <div className="min-h-0 flex-1 overflow-y-auto">
      <BigTable />
    </div>
  </Flex>
</Modal>
```

- 本体ラッパーが `overflow-y-auto` → `overflow-clip` になり、外側スクロールは構造的に発生しない（`overflow-hidden` でないのは、hidden だと scroll container として残り内部の focus 駆動 scrollIntoView で隠れスクロールが発火するため）。
- `height` 未指定なら `maxHeight`（クランプ後）が `height` に自動補完され、箱の高さが確定する。既定 `maxHeight` が生きていれば `scrollable={false}` だけで常にビューポートいっぱいの固定高になる。低くしたい場合は `maxHeight` を明示する。`minHeight` は `height` の下限として `max()` に畳み込まれる（ラッパーは flex 子として縮めるので、低いビューポートでも箱外にはみ出さない）。
- スクロールさせたい内側領域には `min-h-0` + `overflow-y-auto` を自分で付与する（flex 子は `min-h-0` がないと縮まず溢れる）。
- `maxHeight={null}` と併用した場合はラッパー自体が描画されず、高さ管理は consumer に委ねられる。
- TabbedModal にもそのまま透過される（タブ + 固定高 + 内側テーブルの組み合わせが主用途）。

**footer（常時表示アクションバー）:**

```tsx
<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="スタック設定"
  footer={
    <>
      <Button variant="outline" onClick={() => setIsOpen(false)}>キャンセル</Button>
      <Button onClick={handleSubmit}>保存</Button>
    </>
  }
>
  <LongForm />
</Modal>
```

footer はスクロールラッパーの外側（DialogContent 直下）に描画されるため、本体がスクロールしてもボタン列は常に表示される。`sticky bottom-0 bg-background` のような手組みは不要（背景透けの問題も構造的に発生しない）。区切り線（`border-t`）と余白は Modal が付与するので、ボタン列だけを渡せばよい。TabbedModal にもそのまま透過される。

**confirmOnClose（未保存変更の破棄防止ガード）:**

```tsx
<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="一括編集"
  confirmOnClose={{ enabled: isDirty }}
>
  <BulkEditForm />
</Modal>
```

`enabled` が true の間、ユーザー操作による閉じ（✕ ボタン / ESC / 背景クリック）を確認ダイアログ（`layer="alert"` でモーダルの上に表示）で遮り、承諾されたときだけ `onOpenChange(false)` が呼ばれる。文言は `title` / `message` / `confirmLabel` / `cancelLabel` で差し替え可能（既定: 「編集中の内容が保存されていません。閉じてもよろしいですか？」）。見た目は共有の `Overlays/Dialog` に追従する（テーマ/Dialog をカスタマイズしていればそれに従う）。

注意: 親コンポーネントが `open` を直接 false にするプログラム的クローズ（保存完了後など）は遮らない。モーダル内に自前のキャンセルボタンを置く場合、そのボタンが親の state を直接 false にするとガードを通らないため、破棄確認が必要なら自前で確認を挟むか閉じる前に `enabled` を評価すること。確認ダイアログ表示中にプログラム的クローズが起きた場合、確認ダイアログは `open` の解除に同期して畳まれる（次回オープン時に取り残されない）。TabbedModal にもそのまま透過される。

**API 凍結（upstream 方針）:** `confirmOnClose` は「文言4点の差し替え + 共有 Dialog の見た目」の定型ケース省力化として**この形で凍結**する。ボタン variant の変更・任意 JSX の埋め込み・確認 UI の差し替えといった拡張は今後も追加しない。それ以上のカスタムが必要な場合は `confirmOnClose` を使わず、下記の自前ガードレシピを使うこと。

**自前ガードレシピ（完全カスタムの確認 UI を出したい場合）:**

Modal は controlled なので、✕ / ESC / 背景クリックによる閉じ要求はすべて親の `onOpenChange(false)` に届くだけで、親が `open` を false にしない限り閉じない。これを利用して任意の確認 UI を挟める：

```tsx
const [isOpen, setIsOpen] = useState(false);
const [confirmOpen, setConfirmOpen] = useState(false);

<Modal
  open={isOpen}
  onOpenChange={(next) => {
    if (!next && isDirty) {
      setConfirmOpen(true); // 閉じずに自前の確認 UI を開く（UI は何でもよい）
      return;
    }
    setIsOpen(next);
  }}
>
  {/* ... */}
</Modal>
// confirmOpen に応じて任意の確認 UI を表示し、承諾時に setIsOpen(false) を呼ぶ
```

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
| `minHeight` | `number \| string` | `360` | コンテンツ部の最小高さ（Modal 経由で適用）。タブ切替で高さが揺れないための床で、箱の上限に当たる低いビューポートでは床より優先して本体が縮む。不要なら `minHeight={0}` |

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
| `skipDelayDuration` | `number` | -（共有Providerに従う） | 遅延スキップ時間の個別指定（後述） |
| `showArrow` | `boolean` | `true` | 矢印表示 |

### TooltipProvider（共有プロバイダー）

`app/layout.tsx` にアプリ全体で1つ配置済み。隣接するツールチップ間を移動したとき、
直前のツールチップが閉じてから `skipDelayDuration`（デフォルト300ms）以内なら
表示遅延なしで次が即表示される（Radix の仕様上、この挙動は Provider 単位でしか
機能しないため共有している）。

- 各 `Tooltip` は自動で共有 Provider に参加する。**通常は何も意識しなくてよい**
- `Tooltip` に `skipDelayDuration` を明示指定した場合のみ、そのインスタンスは
  個別 Provider にフォールバックし指定値が適用される（後方互換）
- `delayDuration` の個別指定は共有 Provider 配下でもそのまま有効

---

## HelpTip

ラベル + ?アイコン + ホバー説明。テーブルヘッダーやフォームラベルなど
「名前だけでは意味が伝わらない項目」に説明を添える。
デスクトップはホバー、タッチデバイスはタップで開閉。

クリックで開く操作性やリッチな長文コンテンツが必要な場合は `InfoPopover` を使う。

```tsx
import { HelpTip } from "@/components/Overlays/Tooltip";

// DataTable のヘッダー
{
  header: <HelpTip label="詳細CTR" help="詳細クリック ÷ インプレッション。バナーが表示されたうち詳細が開かれた割合" />,
  render: ...
}
```

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `label` | `ReactNode` | - | 表示ラベル |
| `help` | `ReactNode` | - | ホバー/タップで表示する説明文 |
| `iconSize` | `"sm" \| "md" \| "lg"` | `"md"` | ヘルプアイコンのサイズ |
| `side` | `"top" \| "right" \| "bottom" \| "left"` | `"top"` | 表示位置 |
| `layer` | `TooltipLayer` | `"overlay"` | z-indexレイヤー |
| `className` | `string` | - | ラッパーの追加クラス |
| `iconClassName` | `string` | - | アイコンの追加クラス |
| `contentClassName` | `string` | - | ツールチップコンテンツの追加クラス |

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
