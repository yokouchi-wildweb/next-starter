# Overlays/AsyncPickerModal

## Overview

「大量マスタから検索してレコードを選び、リストに入れる」アクション用のピッカーモーダル。在庫編集画面の「商品を追加」、記事編集の「タグを追加」、グループの「メンバーを追加」など、**フォームの 1 項目ではなくボタン起点で N 件取り込む**操作に使う。

- `AsyncMultiSelectInput`(Popover 版)と取得エンジン(`useAsyncOptionSource`: browse ページング / Enter 検索 / searchRank / 無限スクロール / requestId 競合破棄 / ラベル cache)を共有しており、`searchFn` 以下の検索系 props は同じ。違いはクロームだけで、モーダル本体がそのままピッカーになる
- 静的な選択肢(十数件)からの選択は ChecklistPopover(`../Popover/README.md`)
- 使う時の決まりは札 .claude/rules/items/components/Overlays.mdにある。デモ: `/demo/async-picker-modal`

## Usage

```tsx
import { AsyncPickerModal } from "@/components/Overlays/AsyncPickerModal";
import { boardGameClient } from "@/features/boardGame/services/client/boardGameClient"; // 例: 業務ドメインの client(このリポには無い)

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
    <Stack gap="none">
      <Span size="sm" className="truncate">{option.label}</Span>
      {game?.name_kana ? <Span size="xs" tone="muted">{game.name_kana}</Span> : null}
    </Stack>
  )}
  onConfirm={async (ids, games) => {
    await addStocks(games);   // items = 解決済みレコード。id→record の cache を呼び出し側で持つ必要がない
  }}
/>
```

### Modal + AsyncMultiSelectInput の二重構造からの置き換え

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

## API

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` / `onOpenChange` | `boolean` / `(open) => void` | - | controlled。キャンセル / ✕ / 背景クリック / 確定完了で `false` が渡る |
| `title` | `ReactNode` | - | タイトル |
| `description` | `ReactNode` | - | タイトル下の説明文 |
| `searchFn` | `(params: AsyncSearchParams) => Promise<AsyncSearchResult<T>>` | - | 既存の `client.search` をそのまま渡す(型は `@/components/Input/AsyncOptionSource` の呼ぶ形。crud の `SearchParams` はこれを含むので受けられる) |
| `getOptionFromResult` | `(item: T) => Options` | - | レコード → 選択肢 |
| `searchFields` / `searchRank` / `minChars` / `limit` | - | `AsyncMultiSelectInput` と同じ | 検索系オプション |
| `value` | `OptionPrimitive[]` | - | open 時の初期選択値 |
| `initialOptions` | `Options[]` | - | `value` のラベルヒント（未解決時は Skeleton 表示） |
| `disabledValues` | `OptionPrimitive[]` | - | 選択不可にする値。行は表示され `disabledLabelSuffix` が付く（`getOptionFromResult` が返す `Options.disabled` とも OR） |
| `disabledLabelSuffix` | `ReactNode` | `"（追加済み）"` | 選択不可行の接尾表示 |
| `multiple` | `boolean` | `true` | `false` = 単一選択。行クリックで即 `onConfirm([value], [item])` |
| `onConfirm` | `(values, items: T[]) => void \| Promise<void>` | - | 確定。Promise を返すとボタンがローディングになり、resolve 後にモーダルが閉じる。reject は呼び出し元へ伝搬（閉じない） |
| `confirmLabel` | `string \| (count) => string` | `N件を追加` / `追加` | 確定ボタンのラベル |
| `cancelLabel` | `string` | `"キャンセル"` | キャンセルボタンのラベル |
| `searchPlaceholder` / `emptyMessage` / `loadingMessage` | `string` | `"Enterで検索"` / `"該当する項目がありません"` / `"読み込み中..."` | 文言 |
| `renderOption` | `(option: Options, item: T \| undefined) => ReactNode` | - | 行の表示差し替え。`item` は fetch 済みのときだけ渡る |
| `maxWidth` | `number \| string` | `560` | Modal へ透過 |
| `maxHeight` | `number \| string` | `600` | 箱の高さ（固定高モード）。ビューポート上限でクランプされる |

## Internals

- 選択状態はモーダルが持つ。open 時に `value` から初期化し、close で破棄する（Popover 版の session snapshot と同じ。解除した行は「選択済み」タブに残り再選択できる）。
- `onConfirm` の `items` は **この session 中に fetch で見えたレコード**から解決する。`value` で事前選択されたまま一度も表示されなかった値は `items` に含まれない。`values` が正。
- 確定ボタンは選択 0 件で disabled。単一選択（`multiple={false}`）は確定ボタンが無く、`onConfirm` 中は本体をローダーで覆う。
- 高さは Modal の `scrollable={false}` 固定高モード。候補リストの内側だけがスクロールし、二重スクロールは構造的に起きない。
