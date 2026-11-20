# Button

## Overview

- ボタンの部品の群。部品ごとの単位で `@/components/Button/<部品>` から読む。見た目の表は補助の単位 `@/components/Button/variants`
- 使う時・直す時の決まりは札 .claude/rules/items/components/Button.md にある

| 部品 | 描く要素 | 用途 |
|------|---------|------|
| `Button` | button | 標準のボタン。読み込み中(`loading`)、`asChild`、形を自分で付ける押し口(`variant="none" size="none"`) |
| `LinkButton` | a(棚の Link) | ボタンの見た目のリンク。Link の props(gate を含む)をそのまま受ける |
| `PseudoButton` | div | button を入れ子にできない所の押し口(キーボードの Enter / Space も押しになる)。読み込み中は持たない |
| `RoundedButton` | button | 丸い札の形の選ぶボタン(`selected` で配色が変わる) |
| `BookmarkTag` | button | しおりの形の選ぶ札(`selected`、`tagColorClasses` で選んだ時の色) |
| `TabletButton` | button | 卓上端末向けの大きなボタン(タブレット用の高さの段) |

| 補助 | 中身 |
|------|------|
| `variants` | `buttonVariants`・`ButtonStyleProps`・`ButtonVariantName`・`ButtonSizeName`(Button / LinkButton / PseudoButton の表)、`tabletButtonVariants`・`TabletButtonStyleProps`・`TabletButtonVariantName`・`TabletButtonSizeName`(TabletButton の表) |

## Usage

```tsx
import { Button } from "@/components/Button/Button";

<Button onClick={save} disabled={!canSave} loading={isSaving} loadingLabel="保存中...">
  保存
</Button>
<Button variant="outline" onClick={apply} loading={isApplying} loadingLabel={null}>
  適用
</Button>
```

- 実行中の表示は `loading` で持つ。ボタンの中に Spinner を手で組まない(`Button` と `TabletButton`)
- ボタンでない要素にボタンの見た目だけ付ける時は `buttonVariants({ variant, size })`(`@/components/Button/variants`)。ファイル選択のボタンは `FilePickButton` を使う(label + buttonVariants で組まない)

### 形を自分で付ける押し口

カードの行・表のセルの押し口: `Button variant="none" size="none"`(cursor・focus の輪・a11y は Button 共通)。

- 中のアイコンの大きさを呼び手が決める: `iconSizing="none"`(既定 `"auto"` は `size-*` の無い svg を 16px に揃える)
- 生の button と同じに戻す値: 行やカードは `block`(土台は inline-flex)・`whitespace-normal`・`text-[length:inherit] font-normal`、押しを親へ通すなら `propagateClick`
- 例: tableSuite のセルの押し口、purchaseRequest の共有の行、wallet の支払い方法のカード、AccountAvatarSection のアバター

## API

### 共通(Button / LinkButton / PseudoButton)

- `variant`: `default` / `primary` / `destructive` / `success` / `info` / `warning` / `outline` / `secondary` / `ghost` / `accent` / `none`
- `size`: 高さの段 `xxxs`〜`xxxl`(下の表)、`icon`(36px の正方形)、`none`(段の外。形は className で付ける)
- `propagateClick`(Button・TabletButton): クリックを親要素に伝えるか(既定 false)

### 読み込み中(loading / loadingLabel)

- `loading`: true のとき押せなくし(`disabled`)、`aria-busy` を付け、子の前に Spinner(既定の形)を出す。`disabled` の式に実行中の値を足さなくてよい
- `loadingLabel`: 読み込み中に子の代わりに出す中身。未指定 = 子のまま(Spinner + 子)、文字 = Spinner + その文字、`null` = Spinner だけ
- 渡さなければ今の出力のまま(DOM・class とも変わらない)
- `asChild` では効かない: 子(Link など)に Spinner を足さず、`disabled` / `aria-busy` だけ付く
- `PseudoButton`(div で描く)は持たない

### 高さ(size)

ボタン・入力欄・選ぶ欄の引き金は、同じ名前の `size` で同じ高さになる(入力欄の側の表は Form の README「操作部品の高さ」)。

| size | xxxs | xxs | xs | sm | md(既定) | lg | xl | xxl | xxxl |
|---|---|---|---|---|---|---|---|---|---|
| 高さ | 24px | 28px | 32px | 36px | 44px(640px 以上 40px) | 44px | 48px | 56px | 64px |

- md だけ画面の幅で変わる(スマホで押しやすい 44px、640px 以上 = `@media (min-width: 40rem)` で 40px)
- `Button` / `LinkButton` / `PseudoButton` / `FilePickButton`: 9 段すべて。`icon` と `none` は段の外
- `TabletButton`: 別の段 `xxs`〜`xl`(`--tablet-control-h-*` = 48 / 56 / 64 / 72 / 80 / 96px)、`icon` / `icon-lg` は段の外。`variant` は `accent` と `none` を持たない

## Extension

- 形(角丸・影・枠線・寸法): `src/config/lib/variantOverrides.config.ts` の `button`(Button / LinkButton / PseudoButton)・`tabletButton` キー。結合の順は 表 → 上書き → 要素の `className`(後ろが勝つ)
- 高さの段: CSS の変数 `--control-h-<size>` / `--tablet-control-h-<size>`(`src/styles/core/config.css` の `:root`)を上書きすれば全部品の高さが揃って動く
- variant / size の名前は下流の設定が参照する公開契約: 消す・改名する時は notice を出す

## Internals

- 土台は `Primitives/Button`(Slot による `asChild`、`iconSizing`、`baseButtonClassName`)。LinkButton・PseudoButton は `baseButtonClassName` + `buttonVariants` を自分の要素に付ける
- `resolveButtonLoading`(`Button.tsx`)が loading の指定を disabled / aria-busy / 子へ写す。TabletButton も同じ物を使う
- 表の size の高さは段のトークンから取り、数値の `h-*` を持たない(`variants/controlHeight.test.ts`)

## Verification

- `pnpm test src/components/Button`(読み込み中の出力・高さの段)
