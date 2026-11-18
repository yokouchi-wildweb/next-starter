# Overlays

## Overview

- 画面上にオーバーレイ表示するコンポーネント群。入口は `@/components/Overlays/<Name>`
- 使う時・直す時の決まりは札 .claude/rules/items/components/Overlays.mdにある。この README は使い方と仕組み
- 部品ごとの説明: Dialog / Modal / TabbedModal / useConfirm / DialogPrimitives / Command / Toast はこの README、他は下のフォルダの README(Related)

```
DialogPrimitives (低レベル部品、@/components/Primitives/Dialog)
    ├── Dialog (確認用)
    └── Modal (汎用)
         ├── TabbedModal (タブ付き)
         ├── DetailModal (詳細表示)
         └── AsyncPickerModal (大量マスタからの選択)
Sheet (辺から出る板: 下のシート・横の引き出し。Radix Dialog の土台)
useConfirm (関数の中で答えを待つ確認。Dialog を描く)
```

### 使い分け

| コンポーネント | 用途 | 特徴 |
|---------------|------|------|
| **Dialog** | 端的な確認 | テキスト + 確認/キャンセルボタン |
| **Modal** | 複雑な情報表示 | 自由度が高い、フォームや詳細表示など |
| **Modal `scrollable={false}`** | タブ + 内部テーブル等の固定高モーダル | 本体はスクロールせず、内側の指定領域だけがスクロールする |
| **AsyncPickerModal** | 大量マスタから検索してレコードを選びリストに入れる（タグ→記事、ユーザー→グループ、商品→キャンペーン等） | 検索欄 + 無限スクロール候補リスト + 確定フッターをモーダル本体として描画。`AsyncMultiSelectInput` と同じ取得エンジン。フォーム項目ではなくアクションボタン起点のときに使う |
| **ChecklistPopover** | 静的な選択肢（十数件）からの複数選択 | 選択肢を全件 props で渡す。マスタが大きい / 非同期検索が要るなら AsyncPickerModal |

### 重なり(z-index)

- 浮く物(Dialog・Modal・Sheet・Popover・Tooltip・HoverCard・選択の候補)は層を選べない: いつも body へ portal して `floating`、同じ層では後に開いた物が上(層の名は `src/lib/zLayer/README.md`)
- トーストはその上の `toast`、全画面の読み込みは `cover` の層。その中の押しは浮く物の外押しにしない(トーストを押して消しても、読み込みの上を押してもモーダル・ポップオーバーは開いたまま。判定は `@/lib/zLayer` の `isAboveFloatingTarget`)
- 全画面の読み込みは押しを受け止める(`pointer-events-auto`)

## Usage

### Dialog

- 端的な確認を行うためのダイアログ。「削除しますか？」などの確認に使用

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

// 3 つ目の行動（取り消しと確定の間に並ぶ。閉じるかは呼び手が決める）
<Dialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="保存されていない変更があります"
  cancelLabel="留まる"
  extraAction={{ label: "保存せずに離れる", variant: "destructive", onClick: leave }}
  confirmLabel="保存して離れる"
  onConfirm={saveAndLeave}
/>
```

### Modal

- 自由度の高い汎用モーダル。フォームや詳細表示など複雑なコンテンツに使用

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

#### scrollable={false}(固定高コンテナモード)

- タブ + 内部テーブルのように「タブ切替で高さが揺れない」「スクロール領域はちょうど1つ」が要るモーダルで使う。仕組みは Internals「scrollable={false}」

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

- スクロールさせたい内側領域には `min-h-0` + `overflow-y-auto` を自分で付与する(flex 子は `min-h-0` がないと縮まず溢れる)

#### footer(常時表示アクションバー)

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

- footer はスクロールラッパーの外側に描画されるため、本体がスクロールしてもボタン列は常に表示される。区切り線(`border-t`)と余白は Modal が付けるので、ボタン列だけを渡す。TabbedModal にもそのまま透過される

#### confirmOnClose(未保存変更の破棄防止ガード)

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

- `enabled` が true の間、ユーザー操作による閉じ(✕ ボタン / ESC / 背景クリック)を確認ダイアログで遮り、承諾されたときだけ `onOpenChange(false)` が呼ばれる
- 文言は `title` / `message` / `confirmLabel` / `cancelLabel` で差し替え可能(既定: 「編集中の内容が保存されていません。閉じてもよろしいですか？」)。見た目は共有の `Overlays/Dialog` に追従する
- 親が `open` を直接 false にするプログラム的クローズ(保存完了後など)は遮らない。モーダル内の自前のキャンセルボタンが親の state を直接 false にする場合も同じなので、破棄確認が要るならそのボタンで確認を挟む
- 文言 4 点より先のカスタム(ボタン variant・任意 JSX・確認 UI の差し替え)は下の自前ガードで作る

#### 自前ガード(完全カスタムの確認 UI)

- Modal は controlled なので、✕ / ESC / 背景クリックによる閉じ要求はすべて親の `onOpenChange(false)` に届くだけで、親が `open` を false にしない限り閉じない。これを使って任意の確認 UI を挟める

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

#### onOpenAutoFocus / onCloseAutoFocus

- Radix は開いた直後に「最初のフォーカス可能要素」へ自動フォーカスする。先頭が入力欄のモーダルをタッチ端末で開くと、開くたびにソフトウェアキーボードや入力 UI が反応する。これを避けるときに使う(仕組みは Internals「フォーカス」)

```tsx
// 推奨: 入力欄への自動フォーカスを止め、代わりにモーダルの箱自体へフォーカスを移す
<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="来店登録"
  onOpenAutoFocus={(e) => {
    e.preventDefault(); // 既定の自動フォーカスを無効化
    (e.currentTarget as HTMLElement | null)?.focus(); // 箱（role="dialog"）へ移す
  }}
>
  <VisitForm />
</Modal>

// 特定の要素へ移す場合
<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  onOpenAutoFocus={(e) => {
    e.preventDefault();
    submitButtonRef.current?.focus();
  }}
>
  {/* ... */}
</Modal>
```

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

### TabbedModal

- タブ切り替え機能付きモーダル。Modal を拡張(Modal の props をそのまま受ける)

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

#### タブごとの footer

```tsx
<TabbedModal
  footer={<Button variant="outline" onClick={close}>閉じる</Button>} // 共通（未指定タブで使われる）
  tabs={[
    { value: "edit", label: "編集", content: <Form />, footer: <SaveButtons /> }, // このタブだけ差し替え
    { value: "history", label: "履歴", content: <History /> },                    // 共通 footer
    { value: "preview", label: "プレビュー", content: <Preview />, footer: null }, // footer 無し
  ]}
/>
```

- アクティブタブの `footer` が未指定ならモーダル全体の `footer` にフォールバックし、`null` ならそのタブではフッターを出さない。タブごとにフッターの高さが違う場合は切替時に箱の高さが変わるが、本体の `minHeight` は保たれる
- 各タブの `forceMount` を `true` にすると非表示時も DOM を保持し、内部状態がリセットされない(モーダルが開いている間。閉じるとポータルごと unmount される)

### useConfirm(`@/components/Overlays/Confirm`)

- 関数の中で答えを待つ確認(`Promise<boolean>`)。テーブルの `onToggleRequest` のように「呼ばれた所で yes / no を返す」口や、処理の途中で確かめたい時に使う。ボタンから開く確認・画面に置く確認は `Dialog` / `ConfirmPopover`

```tsx
import { useConfirm } from "@/components/Overlays/Confirm";

const { confirm, confirmDialog } = useConfirm();

const onToggleRequest = ({ row }) =>
  confirm({ title: `${row.name} をオフにしますか？`, confirmLabel: "オフにする", confirmVariant: "destructive" });

return (
  <>
    {/* … */}
    {confirmDialog}
  </>
);
```

- `confirmDialog` は画面ごとに置く(アプリ全体の Provider は無い)
- お知らせだけ(`window.alert` の代わり)はトースト(`@/lib/toast` の `useToast`)

### DialogPrimitives(`@/components/Primitives/Dialog`)

- 低レベルの部品群。Dialog / Modal で組めないカスタムのオーバーレイ UI を作る時に使う。本体は `src/components/Primitives/Dialog`(Radix は `radix-ui` から読む)

```tsx
import {
  DialogPrimitives,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/Primitives/Dialog";

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

### Command(`@/components/Primitives/Command`)

- コマンドパレット(入力 + 候補リスト)を自前で組むための低レベル部品(cmdk)。実例: `src/features/core/adminCommand`
- 検索付き選択は `Form/Input/Manual` の `ComboboxInput` / `AsyncComboboxInput` / `MultiSelectInput`、大量マスタからの選択は `AsyncPickerModal`

```tsx
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/Primitives/Command";
```

### Toast

- トースト通知の表示。`@/lib/toast` ライブラリで提供される

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

## API

### Dialog の props

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
| `showCloseButton` | `boolean` | `false` | 右上の ✕ ボタン。`showCancelButton` / `showConfirmButton` を両方 false にした時の閉じ手段 |
| `footerAlign` | `TextAlign` | `"right"` | フッター（ボタン）の配置 |
| `showCancelButton` | `boolean` | `true` | キャンセルボタンの表示 |
| `showConfirmButton` | `boolean` | `true` | 確認ボタンの表示 |
| `confirmLabel` | `string` | `"OK"` | 確認ボタンのラベル |
| `cancelLabel` | `string` | `"Cancel"` | キャンセルボタンのラベル |
| `onConfirm` | `() => void \| Promise<void>` | - | 確認時のコールバック |
| `confirmDisabled` | `boolean` | - | 確認ボタンの無効化 |
| `confirmVariant` | `ButtonStyleProps["variant"]` | `"primary"` | 確認ボタンのスタイル |
| `cancelVariant` | `ButtonStyleProps["variant"]` | `"outline"` | キャンセルボタンのスタイル |
| `onOpenAutoFocus` | `(event: Event) => void` | - | 開いた直後の自動フォーカス制御（使い方は Modal の「onOpenAutoFocus の使用例」と同じ） |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御 |
| `className` | `string` | - | 本体（箱）に足すクラス |
| `overlayClassName` | `string` | - | 背景（覆い）に足すクラス（色・ぼかし等） |
| `fullscreen` | `boolean` | `false` | 全画面（Modal の `fullscreen` と同じ: 角丸・枠・最大幅・内側の余白なし、上下は safe-area の分だけ、閉じるボタンは内側） |
| `container` | `HTMLElement \| null` | - | portal の先の要素（省略 = body）。渡すと背景と本体はその要素の中で `absolute` に重なる |
| `extraAction` | `DialogExtraAction` | - | 取り消しと確定の間に置く 3 つ目のボタン `{ label, onClick, variant?（既定 "outline"）, disabled? }`。押すと `onClick` だけを呼ぶ（`onOpenChange` は呼ばない）。Promise を返す間は全部のボタンが止まり、押したボタンだけ「処理中...」 |

```ts
type TextVariant = "default" | "primary" | "secondary" | "accent" | "sr-only";
type TextAlign = "left" | "center" | "right";
```

### Modal の props

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
| `bodyRef` | `Ref<HTMLDivElement>` | - | 本体ラッパー（スクロール領域）の DOM 参照。スクロール位置を操作したい場合に使う（TabbedModal はタブ切替時の先頭戻しに使用） |
| `onOpenAutoFocus` | `(event: Event) => void` | - | 開いた直後の自動フォーカス制御。未指定時は Radix 既定（最初のフォーカス可能要素へフォーカス） |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御 |
| `overlayClassName` | `string` | - | 背景（覆い）に足すクラス（色・ぼかし等）。省略時は今の `bg-overlay/50` |
| `fullscreen` | `boolean` | `false` | 全画面: 角丸・枠・最大幅・中央寄せを外し、高さ `100dvh`。余白は上下の safe-area の分だけで、中身の余白は `className` / 中身で決める。閉じるボタンは画面の内側の右上、本体は箱の残りいっぱいでスクロールする（`maxHeight` 既定のとき） |
| `container` | `HTMLElement \| null` | - | portal の先の要素（省略 = body）。渡すと背景と本体はその要素の中で `absolute` に重なる（要素に `relative` 等の position が要る）。`fullscreen` と併せると容器いっぱい（`h-full`） |

### TabbedModal の props(Modal の props も継承)

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `tabs` | `TabbedModalTab[]` | - | `{ value, label, content, footer?, disabled?, forceMount?, triggerClassName?, contentClassName? }` の配列 |
| `ariaLabel` | `string` | `"モーダル内のタブ"` | タブリストを囲う nav の aria-label |
| `value` | `string` | - | 制御用の現在タブ |
| `defaultValue` | `string` | `tabs[0].value` | 非制御時の初期タブ。モーダルを開くたびにこの値へ戻る |
| `onValueChange` | `(value: string) => void` | - | 制御／非制御共通の変更通知 |
| `tabsClassName` | `string` | - | Tabs.Root に付与するクラス。Root は `display: contents` でレイアウトを持たないため、レイアウト系クラスは効かない |
| `tabListClassName` | `string` | - | TabsList に付与するクラス |
| `tabTriggerClassName` | `string` | - | 各 TabsTrigger に共通で付与するクラス |
| `tabContentClassName` | `string` | - | TabsContent に共通で付与するクラス |
| `headerContent` | `ReactNode` | - | 題の下・タブの列の上に描く中身（利用者の名前・残高・操作のボタン等）。本文のスクロールの外に置かれ、タブを替えても残る |
| `minHeight` | `number \| string` | `360` | コンテンツ部の最小高さ（Modal 経由で適用）。タブ切替で高さが揺れないための床で、箱の上限に当たる低いビューポートでは床より優先して本体が縮む。不要なら `minHeight={0}` |

### useConfirm

- `confirm(options?)` = 確定で `true`、取り消し / ✕ / ESC / 背景で `false`。options は Dialog の `title` / `description` / `confirmLabel`(既定 "OK")/ `cancelLabel`(既定 "キャンセル")/ `confirmVariant`(型 `ConfirmOptions`)
- 開いている間に次の `confirm` が来たら前は `false` で解けて次が出る。画面が外れたら待っている物は `false` で解ける

### DialogContent の主な追加 props

- `showCloseButton`（デフォルト `true`）: 右上の Close ボタンの表示有無
- `maxWidth` / `minHeight` / `maxHeight` / `height`: サイズ調整。数値は `px` として解釈。

### Toast の主なオプション(省略時のデフォルト値)

- `variant`: `info`（`mode: "persistent"` の場合は `loading`）
- `mode`: `"notification"`（自動消去） / `"persistent"`（手動消去）
- `position`: `"bottom-center"`
- `duration`: `3000` ms（persistent では無視）
- `size`: `"md"`
- `spinning`: `variant === "loading"` または `mode === "persistent"` のとき自動で `true`
- `icon`: プリセット文字列（`success` など）または `ReactNode`

## Internals

### Dialog の高さ

- 箱は Modal と同じ `max-h-[calc(100dvh-2rem)]` で上限され、長い `children` は本体だけがスクロールする（title / description / ボタン列は常に箱内）。`title` 省略時も sr-only の既定タイトルが入り、`role="dialog"` のアクセシブルネームが欠けることはない。

### Modal の高さ(単一の真のソース = 箱の上限)

- デフォルトで `maxHeight` が設定されているため、長いコンテンツは常にビューポート内に収まり内部スクロールされる。タイトル部 (DialogHeader) は固定で、本体だけがスクロールする。デフォルトを無効化したい場合は `maxHeight={null}` を渡す
- モーダルの箱（DialogContent）は `flex-col` + `max-h-[calc(100dvh-2rem)]`。ヘッダ（title + headerContent）と footer は `shrink-0`、本体ラッパーは `min-h-0` の flex 子。箱が上限に達すると**本体ラッパーだけが縮んでスクロール**するため、ヘッダ・タブ列・footer の実高がいくらであっても、close ボタンや footer が箱外・画面外に押し出されることは構造的に起きない。consumer が「クローム分の予算」を計算して `maxHeight` を調整する必要はない。
- `maxHeight` / `height` に既定値（`calc(100dvh - 2rem)`）を超える値（例: `90vh`）を渡しても `min()` でクランプされる。既定値以下の値（`85vh` 等）はそのまま効く。`maxHeight={null}` を渡すとクランプも箱の上限も解除される。
- `minHeight` はラッパーではなく本体内側の要素に付く。短い内容では本体が `minHeight` まで確保され（タブ切替で高さが揺れない）、箱の上限に当たる低いビューポートでは床より優先してラッパーが縮み、内側がスクロールする。

### scrollable={false}

タブ + 内部テーブルのようなモーダルでは「タブ切替で高さが揺れない」「スクロール領域はちょうど1つ（内側のテーブルだけ）」が必要になる。デフォルトの Modal は「高さ制約 = 本体が overflow-y-auto」なので、内側に独自のスクロール領域を作ると 1px の溢れでも外側スクロールバーが復活して二重スクロールになる。`scrollable={false}` はこの結合を切る：

- 本体ラッパーが `overflow-y-auto` → `overflow-clip` になり、外側スクロールは構造的に発生しない（`overflow-hidden` でないのは、hidden だと scroll container として残り内部の focus 駆動 scrollIntoView で隠れスクロールが発火するため）。
- `height` 未指定なら `maxHeight`（クランプ後）が `height` に自動補完され、箱の高さが確定する。既定 `maxHeight` が生きていれば `scrollable={false}` だけで常にビューポートいっぱいの固定高になる。低くしたい場合は `maxHeight` を明示する。`minHeight` は `height` の下限として `max()` に畳み込まれる（ラッパーは flex 子として縮めるので、低いビューポートでも箱外にはみ出さない）。
- `maxHeight={null}` と併用した場合はラッパー自体が描画されず、高さ管理は consumer に委ねられる。
- TabbedModal にもそのまま透過される（タブ + 固定高 + 内側テーブルの組み合わせが主用途）。

### footer と confirmOnClose の構造

- footer は DialogContent 直下に描画される。`sticky bottom-0 bg-background` の手組みと違い、背景の透けは構造的に起きない
- confirmOnClose の確認ダイアログは `floating` のままモーダルの後に開くので上に表示される。表示中にプログラム的クローズが起きた場合、確認ダイアログは `open` の解除に同期して畳まれる(次回オープン時に取り残されない)。TabbedModal にもそのまま透過される

### フォーカス

- イベントは箱（`role="dialog"` の要素、`tabIndex=-1`）上で発火するため、`e.currentTarget` が箱自体を指す。
- `e.preventDefault()` だけでも抑止はできるが、フォーカスがモーダルの外（開いたトリガー）に残る。Radix のフォーカストラップ（Tab 移動の閉じ込め）は「フォーカスが一度箱の中に入ってから」効き始めるため、抑止だけだとキーボードの Tab が背面の要素へ流れ、スクリーンリーダーの起点もモーダル内に入らない。そのため Usage の例は箱か内部要素へ移している。ESC での閉じは抑止単独でも機能する。
- 未指定時の挙動は従来どおり（Radix 既定）。Dialog / TabbedModal / DetailModal でも同じ prop が使える。
- Popover 系は `PopoverContent` の props をそのまま透過しているため、元から `onOpenAutoFocus` / `onCloseAutoFocus` を渡せる。

### TabbedModal の構造

- 本体スクロール領域は全タブで共有され、タブ切替時に先頭へ戻る（Modal の `bodyRef` 経由）。
- 閉じるときは Modal と同じく Radix の閉じアニメーションとトリガーへのフォーカス復帰が働く（`onCloseAutoFocus` 有効）。
- 開いた直後の自動フォーカスも Modal と同じく `onOpenAutoFocus` で制御できる（Modal の props を継承して透過）。
- `Tabs.Root` は呼び出し元ツリーに `display: contents` で置かれ、Stack 等の flex/gap レイアウトを消費しない。

## Related

- `Popover/README.md`: Popover・ConfirmPopover・PromptPopover・ActionPopover・ChecklistPopover・InfoPopover
- `AsyncPickerModal/README.md`: 大量マスタからの選択モーダル
- `DetailModal/README.md`: 詳細表示モーダルと DetailTable
- `Sheet/README.md`: 辺から出る板
- `ImageViewer/README.md`: 画像のズーム表示
- `Loading/README.md`: Spinner・InlineLoader・ScreenLoader
- `Tooltip/README.md`: Tooltip・TooltipProvider・HelpTip
- `HoverCard/README.md`: ホバープレビュー
- 層の名: `src/lib/zLayer/README.md`
