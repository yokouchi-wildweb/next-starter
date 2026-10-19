# Overlays コンポーネント

画面上にオーバーレイ表示するコンポーネント群。

---

## コンポーネント階層

```
DialogPrimitives (低レベル部品)
    ├── Dialog (確認用)
    └── Modal (汎用)
         ├── TabbedModal (タブ付き)
         ├── DetailModal (詳細表示)
         └── AsyncPickerModal (大量マスタからの選択)
```

---

## Dialog / Modal の使い分け

| コンポーネント | 用途 | 特徴 |
|---------------|------|------|
| **Dialog** | 端的な確認 | テキスト + 確認/キャンセルボタン |
| **Modal** | 複雑な情報表示 | 自由度が高い、フォームや詳細表示など |
| **Modal `scrollable={false}`** | タブ + 内部テーブル等の固定高モーダル | 本体はスクロールせず、内側の指定領域だけがスクロールする |
| **AsyncPickerModal** | 大量マスタから検索してレコードを選びリストに入れる（タグ→記事、ユーザー→グループ、商品→キャンペーン等） | 検索欄 + 無限スクロール候補リスト + 確定フッターをモーダル本体として描画。`AsyncMultiSelectInput` と同じ取得エンジン。フォーム項目ではなくアクションボタン起点のときに使う |
| **ChecklistPopover** | 静的な選択肢（十数件）からの複数選択 | 選択肢を全件 props で渡す。マスタが大きい / 非同期検索が要るなら AsyncPickerModal |

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
| `onOpenAutoFocus` | `(event: Event) => void` | - | 開いた直後の自動フォーカス制御（使い方は Modal の「onOpenAutoFocus の使用例」と同じ） |
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
| `bodyRef` | `Ref<HTMLDivElement>` | - | 本体ラッパー（スクロール領域）の DOM 参照。スクロール位置を操作したい場合に使う（TabbedModal はタブ切替時の先頭戻しに使用） |
| `onOpenAutoFocus` | `(event: Event) => void` | - | 開いた直後の自動フォーカス制御。未指定時は Radix 既定（最初のフォーカス可能要素へフォーカス） |
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

**onOpenAutoFocus の使用例:**

Radix は開いた直後に「最初のフォーカス可能要素」へ自動フォーカスする。先頭が入力欄のモーダルをタッチ端末で開くと、開くたびにソフトウェアキーボードや入力 UI が反応してしまう。これを避けたい場合に使う。

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

- イベントは箱（`role="dialog"` の要素、`tabIndex=-1`）上で発火するため、`e.currentTarget` が箱自体を指す。
- `e.preventDefault()` だけでも抑止はできるが、フォーカスがモーダルの外（開いたトリガー）に残る。Radix のフォーカストラップ（Tab 移動の閉じ込め）は「フォーカスが一度箱の中に入ってから」効き始めるため、抑止だけだとキーボードの Tab が背面の要素へ流れ、スクリーンリーダーの起点もモーダル内に入らない。上記のように箱か内部要素へ移すことを推奨する（タッチ専用画面で割り切る場合のみ抑止単独でも可）。ESC での閉じは抑止単独でも機能する。
- 未指定時の挙動は従来どおり（Radix 既定）。Dialog / TabbedModal / DetailModal でも同じ prop が使える。
- Popover 系は `PopoverContent` の props をそのまま透過しているため、元から `onOpenAutoFocus` / `onCloseAutoFocus` を渡せる。

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
| `tabs` | `TabbedModalTab[]` | - | `{ value, label, content, footer?, disabled?, forceMount?, triggerClassName?, contentClassName? }` の配列 |
| `ariaLabel` | `string` | `"モーダル内のタブ"` | タブリストを囲う nav の aria-label |
| `value` | `string` | - | 制御用の現在タブ |
| `defaultValue` | `string` | `tabs[0].value` | 非制御時の初期タブ。モーダルを開くたびにこの値へ戻る |
| `onValueChange` | `(value: string) => void` | - | 制御／非制御共通の変更通知 |
| `tabsClassName` | `string` | - | Tabs.Root に付与するクラス。Root は `display: contents` でレイアウトを持たないため、レイアウト系クラスは効かない |
| `tabListClassName` | `string` | - | TabsList に付与するクラス |
| `tabTriggerClassName` | `string` | - | 各 TabsTrigger に共通で付与するクラス |
| `tabContentClassName` | `string` | - | TabsContent に共通で付与するクラス |
| `minHeight` | `number \| string` | `360` | コンテンツ部の最小高さ（Modal 経由で適用）。タブ切替で高さが揺れないための床で、箱の上限に当たる低いビューポートでは床より優先して本体が縮む。不要なら `minHeight={0}` |

各タブの `forceMount` を `true` にすると非表示時も DOM を保持し、内部状態がリセットされない（モーダルが開いている間。閉じるとポータルごと unmount される）。

**タブごとの footer:**

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

アクティブタブの `footer` が未指定ならモーダル全体の `footer` にフォールバックし、`null` ならそのタブではフッターを出さない。タブごとにフッターの高さが違う場合は切替時に箱の高さが変わるが、本体の `minHeight` は保たれる。

**構造メモ:**
- 本体スクロール領域は全タブで共有され、タブ切替時に先頭へ戻る（Modal の `bodyRef` 経由）。
- 閉じるときは Modal と同じく Radix の閉じアニメーションとトリガーへのフォーカス復帰が働く（`onCloseAutoFocus` 有効）。
- 開いた直後の自動フォーカスも Modal と同じく `onOpenAutoFocus` で制御できる（Modal の props を継承して透過）。
- `Tabs.Root` は呼び出し元ツリーに `display: contents` で置かれ、Stack 等の flex/gap レイアウトを消費しない。

---

### DetailModal

詳細表示用モーダル。画像/動画 + テーブル形式のデータ表示に特化。

```tsx
import DetailModal from "@/components/Overlays/DetailModal";

<DetailModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="商品詳細"
  badge={{ text: "公開中", variant: "success" }}
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
| `badge` | `{ text: string; variant?: BadgeVariant }` | `variant: "success"` | タイトル横に表示するバッジ(`SolidBadge`) |
| `media` | `{ type?: "image" \| "video"; url: string; alt?: string; poster?: string }` | `type: "image"` | メディアプレビュー |
| `rows` | `DetailModalRow[]` | - | `{ label, value }` の配列、または `ReactNode[]` によるカスタム行 |
| `footer` | `ReactNode` | - | テーブル下に任意のフッターを配置 |
| `className` | `string` | - | 追加クラス |
| `onOpenAutoFocus` | `(event: Event) => void` | - | 開いた直後の自動フォーカス制御（Modal へ透過） |
| `onCloseAutoFocus` | `(event: Event) => void` | - | 閉じた後のフォーカス制御（Modal へ透過） |

`rows` へ `ReactNode[]` を渡すと、列幅を柔軟に変えたカスタム行を作成できる。

---

### AsyncPickerModal

「大量マスタから検索してレコードを選び、リストに入れる」アクション用のピッカーモーダル。在庫編集画面の「商品を追加」、記事編集の「タグを追加」、グループの「メンバーを追加」など、**フォームの 1 項目ではなくボタン起点で N 件取り込む**操作に使う。

`AsyncMultiSelectInput`（Popover 版）と取得エンジン（`useAsyncOptionSource`: browse ページング / Enter 検索 / searchRank / 無限スクロール / requestId 競合破棄 / ラベル cache）を共有しており、`searchFn` 以下の検索系 props は同じ。違いはクロームだけで、モーダル本体がそのままピッカーになる（Modal の中に AsyncMultiSelectInput を置く二重構造にしない）。

```tsx
import { AsyncPickerModal } from "@/components/Overlays/AsyncPickerModal";
import { boardGameClient } from "@/features/boardGame/services/client/boardGameClient";

const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>在庫を追加</Button>
<AsyncPickerModal<BoardGame>
  open={open}
  onOpenChange={setOpen}
  title="ボードゲームを追加"
  searchFn={boardGameClient.search!}
  getOptionFromResult={(g) => ({ value: g.id, label: g.name })}
  searchFields={["name", "name_kana"]}
  disabledValues={stocks.map((s) => s.board_game_id)}   // 追加済みは行を残して選択不可
  renderOption={(option, game) => (                       // name + かな の 2 行表示
    <Stack space={0}>
      <Span size="sm" className="truncate">{option.label}</Span>
      {game?.name_kana ? <Span size="xs" tone="muted">{game.name_kana}</Span> : null}
    </Stack>
  )}
  onConfirm={async (ids, games) => {
    await addStocks(games);   // items = 解決済みレコード。id→record の cache を呼び出し側で持つ必要がない
  }}
/>
```

**Props:**

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` / `onOpenChange` | `boolean` / `(open) => void` | - | controlled。キャンセル / ✕ / 背景クリック / 確定完了で `false` が渡る |
| `title` | `ReactNode` | - | タイトル |
| `description` | `ReactNode` | - | タイトル下の説明文 |
| `searchFn` | `(params: SearchParams) => Promise<PaginatedResult<T>>` | - | 既存の `client.search` をそのまま渡す |
| `getOptionFromResult` | `(item: T) => Options` | - | レコード → 選択肢 |
| `searchFields` / `searchRank` / `minChars` / `limit` | - | `AsyncMultiSelectInput` と同じ | 検索系オプション |
| `value` | `OptionPrimitive[]` | `[]` | open 時の初期選択値 |
| `initialOptions` | `Options[]` | - | `value` のラベルヒント（未解決時は Skeleton 表示） |
| `disabledValues` | `OptionPrimitive[]` | - | 選択不可にする値。行は表示され `disabledLabelSuffix` が付く |
| `disabledLabelSuffix` | `ReactNode` | `"（追加済み）"` | 選択不可行の接尾表示 |
| `multiple` | `boolean` | `true` | `false` = 単一選択。行クリックで即 `onConfirm([value], [item])` |
| `onConfirm` | `(values, items: T[]) => void \| Promise<void>` | - | 確定。Promise を返すとボタンがローディングになり、resolve 後にモーダルが閉じる。reject は呼び出し元へ伝搬（閉じない） |
| `confirmLabel` | `string \| (count) => string` | `N件を追加` / `追加` | 確定ボタンのラベル |
| `cancelLabel` | `string` | `"キャンセル"` | キャンセルボタンのラベル |
| `searchPlaceholder` / `emptyMessage` / `loadingMessage` | `string` | - | 文言 |
| `renderOption` | `(option: Options, item: T \| undefined) => ReactNode` | - | 行の表示差し替え。`item` は fetch 済みのときだけ渡る |
| `maxWidth` | `number \| string` | `560` | Modal へ透過 |
| `maxHeight` | `number \| string` | `600` | 箱の高さ（固定高モード）。ビューポート上限でクランプされる |

**挙動のメモ:**

- 選択状態はモーダルが持つ。open 時に `value` から初期化し、close で破棄する（Popover 版の session snapshot と同じ。解除した行は「選択済み」タブに残り再選択できる）。
- `onConfirm` の `items` は **この session 中に fetch で見えたレコード**から解決する。`value` で事前選択されたまま一度も表示されなかった値は `items` に含まれない。`values` が正。
- 確定ボタンは選択 0 件で disabled。単一選択（`multiple={false}`）は確定ボタンが無く、`onConfirm` 中は本体をローダーで覆う。
- 高さは Modal の `scrollable={false}` 固定高モード。候補リストの内側だけがスクロールし、二重スクロールは構造的に起きない。
- `ChecklistPopover` は静的選択肢専用で代替にならない。マスタが大きい / 非同期検索が要るなら必ずこちら。

**置き換えレシピ（Modal + AsyncMultiSelectInput の二重構造から）:**

```tsx
// Before: モーダルの中に入力があり、入力をクリックして Popover を開く二段操作
<Modal open={open} onOpenChange={setOpen} title="追加" footer={<Button onClick={() => onAdd(selectedRecords)}>追加</Button>}>
  <AsyncMultiSelectInput value={ids} onChange={setIds} searchFn={client.search!} getOptionFromResult={toOption} />
</Modal>
// 呼び出し側で id→record の cache を自前管理していた

// After: モーダル本体がピッカー。選択状態・id→record 解決はモーダル側
<AsyncPickerModal open={open} onOpenChange={setOpen} title="追加"
  searchFn={client.search!} getOptionFromResult={toOption}
  disabledValues={existingIds}
  onConfirm={async (_ids, records) => { await onAdd(records); }} />
```

デモ: `/demo/async-picker-modal`

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

### CommandPrimitives

コマンドパレット（入力 + 候補リスト）を自前で組むための低レベル部品。`_shadcn/command` のプロジェクト向け入口で、`src/components` 外からは必ずここを経由する（直接 import は ESLint が止める）。

```tsx
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/Overlays/CommandPrimitives";
```

フォームの選択入力には使わない。検索付き選択は `Form/Input/Manual` の `ComboboxInput` / `AsyncComboboxInput` / `MultiSelectInput`、大量マスタからの選択は `AsyncPickerModal`。実例: `src/features/core/adminCommand`。

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
| `usePortal` | `boolean` | 自動判定 | 未指定時は Dialog / Modal の中に居るとき非ポータル（Radix Dialog のスクロールロックが body 直下ポータルの wheel/touch を食うため）。判定は DialogContent の React context で行われ、初回 render から確定する |

**高さ（PopoverContent 共通）:** Radix が算出する配置側のビューポート残り高さ（`--radix-popover-content-available-height`）を上限とし、超える場合は内側のラッパーだけがスクロールする。長いリスト + フッターのポップオーバーでも確定ボタンが画面外に出ることはない。矢印（`showArrow`）はこの上限の外側に描画される。HoverCard も同じ構造。

**Dialog / Modal 内での外側判定（PopoverContent 共通）:** 外側クリックで閉じる標準 UX は維持しつつ、次の 2 つだけは閉じない。(1) Dialog 自身の dismiss chrome（オーバーレイ / 閉じるボタン）への操作（`preventLayerDismiss`、既定 true）。(2) Dialog の FocusScope がコンテナ自身へプログラム的に focus を戻した `focusin`（常時）。(2) が無いと、Popover 内のボタンが「クリック → `disabled` + スピナー差し替え」でフォーカスを失った瞬間に Radix が DialogContent へ focus し、処理中の Popover が勝手に閉じる（非同期の確定ボタン全般で再現）。判定は `isDialogFocusRestoration.ts`（純粋関数、`pnpm test:popover-dismiss`）。空のモーダル本体クリックは pointerdown 側で従来どおり閉じる。

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
| `maxListHeight` | `number \| string` | `330` | リストの最大高さ（スクロール） |

開いている最中に親が再レンダーして `value` の配列参照が変わっても、選択途中の状態と検索文字列は保持される（リセットは open の false→true 遷移時のみ）。

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
