# src/styles — Extension(層ごとの書き方)

## Overview

- 見た目の層ごとに、fork(と upstream)が値を書く場所と書き方。どの層で変えるかは [README.md](./README.md) の Overview「層の地図」と Usage「早見表」

## Extension

### 色の正は CSS

色の唯一の正は `core/palette.css`(既定)と直下の `palette.css`(上書き)。派生物はそこから生成する:

- メール用 hex 定数: `pnpm generate styles`(両ファイルの `:root` を合成して `src/lib/mail/generated/themeColors.ts`(`@/lib/mail` の `MAIL_THEME_COLORS`)を生成。欠落があれば失敗する)。色を変えたら必ず実行してコミットする。メールはダークモードもエリアも持たないので `.dark` と `[data-area]` は読まない。ブランド色を `[data-area="user"]` にだけ書くとメールは汎用色のままになる。メールにも反映したい色は `:root` にも書くこと
- gradient トークン: `pnpm generate styles`(`tokens.base.ts` → `core/gradient.css`、`src/config/lib/gradient.config.ts` → 直下の `gradient.css`。palette には依存しない)

枠の部位を隠す規則: `core/frame.css`(手書きの静的な規則。各ルートの枠の宣言(ルートを作ったリポの `frame.ts` / 下のリポの `frame.override.ts`)を UserLayout が外枠の属性にし、その属性で部位を隠す)。色・値は持たない(規則だけ)ので fork のファイルからの上書きは想定しない。部位の一覧との一致は `pnpm test 'src/app/(user)/_layout/'`。仕組みは src/app/(user)/_layout/README.md「枠の部位を隠す・fill(枠の宣言)」

shadcn / tweakcn 等のジェネレータが出力する `:root { ... } .dark { ... }` は、そのまま直下の `palette.css` に貼れば効く。

### 色(palette.css)

```css
:root {
  --primary: oklch(0.6 0.2 255);
  --primary-foreground: oklch(0.985 0 0);
}
.dark {
  --primary: oklch(0.7 0.18 255);
}

/* ユーザー側だけブランド色にし、管理画面は汎用色のまま */
[data-area="user"] {
  --background: oklch(0.12 0.02 260);
  --foreground: oklch(0.97 0 0);
}
.dark[data-area="user"] {
  --card: oklch(0.18 0.02 260);
}
```

- 変数名と既定値の一覧は `core/palette.css`
- `data-area` は `<html>` に付く(root layout が SSR 付与)。値は `src/config/lib/siteTheme.config.ts` で決まるエリア key(既定: `user` / `admin`)
- Dialog / Toast / Popover は body 直下にポータル描画されるが、`<html>` 属性なので自動で継承される

#### 意味色は 3 変数で 1 組(塗り / 塗りの上の文字 / 素の背景の文字)

`success` / `info` / `warning` / `destructive` の 4 色は、用途の違う 3 変数を持つ。core の部品はこの区別で書かれているので、fork は役割ごとに値を決めるだけでよい。

| 変数 | 用途 | Tailwind | 例 |
|---|---|---|---|
| `--success` | 塗り(背景・枠線・アイコンの台・スイッチ) | `bg-success` / `border-success` / `ring-success` | ボタン・ソリッドバッジの背景 |
| `--success-foreground` | 塗りの上に載せる文字・アイコン | `text-success-foreground` | ボタンのラベル |
| `--success-text` | 素の背景(ページ・カード)に置く文字・アイコン | `text-success-text` | 完了メッセージ、ソフトバッジの文字、`<Para tone="success">` |

塗りを淡いパステルにしたいなら `--success` だけ変える。`--success-text` を変えなければ本文は読めるまま。塗り用トークンを文字色に使う(`text-success`)のは禁止(fork が塗りを淡くすると読めなくなる)。既定値はライトが amber-600 / red-600 / emerald-600 / sky-600 相当、ダークがその 400 系(ダーク背景で読める明るさ)。`.dark { --success-text: ... }` で上書きできる。

`--overlay` は画面を覆う幕(モーダル背景・SP ナビの背景)。`bg-overlay/50` のように透過率付きで使う(既定は黒)。

### appearance の影(palette.css)

Layout 部品(Block / Section / Stack / Flex / Grid / Main)の `appearance` の影は、見た目の種類ごとのトークン `--appearance-shadow-<name>`(`raised` / `outlined` / `frosted` / `soft` / `radiant`)が持つ。値は `box-shadow` の全体で、ライト / ダークで別の値を持てる。色と同じ所(`palette.css` の `:root` / `.dark`)で変える。

```css
:root {
  --appearance-shadow-raised: 0 8px 24px -12px rgb(0 0 0 / 0.25);
}
.dark {
  --appearance-shadow-raised: 0 8px 24px -12px rgb(0 0 0 / 0.6);
}
```

- 汎用の影の段(`shadow-sm` 等)は Tailwind の `--shadow-*` で、これとは別(「角丸・Tailwind の影の段・イージング」)
- `appearance.ts` に影の値を直書きしない。影をブランド色に追従させたいときは値に `color-mix(in oklch, var(--primary) 20%, transparent)` を書く(既定の radiant がこの形)
- トークンの値は `<html>`(`:root` / `.dark` / `[data-area]` の付く要素)で計算される。`--primary` を `<html>` より下の要素で変えても、影の中の `var(--primary)` は追従しない

### 書体(fonts.ui.config.ts と typography.css)

書体は 2 段構え。既定では Web フォントを読み込まず system スタックで表示する。

| やりたいこと | 書く場所 |
|---|---|
| Web フォントを読み込む(Google Fonts / ローカルファイル) | 上書き `src/config/lib/fonts.ui.config.ts`(next/font) |
| Web フォントは使わず system フォントの並びを変える | `typography.css` の `--font-geist-sans` |
| 文字サイズ(流体サイズ等)を変える | `typography.css` の `@theme` |

仕組み: next/font のローダーを `variable: "--font-sans-loaded"`(mono は `"--font-mono-loaded"`)で呼び上書きの `export default { sans }` に渡すと、root layout が `<html>` にクラスを当ててその変数を定義する。`core/typography.css` のスタックは `--font-geist-sans: var(--font-sans-loaded, "Inter", system-ui, ...)` と書かれているので、読み込まれていればそれを、無ければ system スタックを使う。theme.css と Tailwind の `font-sans` / `font-mono` は一切変えない。

```ts
// src/config/lib/fonts.ui.config.ts
import { Noto_Sans_JP } from "next/font/google";
import type { FontsOverride } from "@/lib/fonts";
const sans = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans-loaded", display: "swap" });
export default { sans } satisfies FontsOverride;
```

next/font の制約: ローダーはモジュールのトップレベルで、引数はリテラル(変数や import 定数は不可)。`variable` 名は上の固定文字列をそのまま書く。別名を書いても型や実行時では検知できず黙って効かなくなるため、`pnpm test src/lib/fonts/fonts.test.mjs` が上書き `fonts.ui.config.ts` のソースを静的に検査する。Google Fonts はビルド時に取得されセルフホスト化される(実行時に Google への通信は発生しない)。next/font は Next のコンパイラ外(scripts/ や node --test)では動かないので、上書きを読むのは root layout(持ち主の `config.ui.ts` 経由)だけ。

```css
/* src/styles/typography.css */
:root {
  --font-geist-sans: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;  /* system フォントの並びだけ変える */
}
@theme {
  --text-fluid-5xl: clamp(2.5rem, 6vmin, 4rem);   /* theme.css の流体サイズを同名で上書き */
}
```

注意: `typography.css` で `--font-geist-sans` を上書きすると、その値が `fonts.ui.config.ts` で読み込んだ Web フォントより優先される(loaded 変数への参照を自分で消すことになる)。両方使う場合は `var(--font-sans-loaded, ...)` を含めて書く。

メールテンプレートの書体は別系統(各テンプレートの inline `fontFamily`、メールクライアント向けの system スタック)で、この設定の影響を受けない。

### 角丸・Tailwind の影の段・イージング

```css
/* 角丸: --radius は core/palette.css が無レイヤーの :root で定義しているので、同じ :root で上書きする
   (@theme { --radius } は @layer theme に入り、無レイヤーの :root に負けて効かない) */
:root {
  --radius: 1rem;            /* theme.css の --radius-sm/md/lg/xl が連動する */
}
/* 影の段・イージングは Tailwind の名前空間トークン(上流に無レイヤー定義が無い)なので @theme で効く */
@theme {
  --shadow-xs: none;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.1);
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
}
```

判断基準: `core/palette.css` / `config.css` / `z-layer.css` に `:root { --x }` として定義済みの変数(`--appearance-shadow-*` を含む)は `:root` で、それ以外の Tailwind 名前空間(`--shadow-*` / `--ease-*` / `--text-*` / `--animate-*` 等)は `@theme` で上書きする。

### overrides.css(要素の既定・data-slot)

- 書くもの: 要素の既定(`body`、`a`、`::selection`、scrollbar)、`@keyframes`、`[data-area="admin"] body { ... }` のようなエリア単位の全体調整、上流の枠・部品の内側への `[data-slot="<名前>"]` の規則
- 無レイヤーなので、同じプロパティの className より常に勝つ(README.md の Usage「勝ち順」)。ボタンやバッジの形は data-slot ではなく `variants.config.ts` で変える(variant / size ごとに変えられ、className の個別指定も残る)

### バリアントの上書き(variants.config.ts)

Button / Badge・入力欄系(Input・選ぶ欄の引き金)・入力部品(真偽のチェック・ラジオ・カード型チェック・ステッパー・スイッチ)・TextBlocks(PageTitle / Para / SecTitle / Span)の形(角丸・影・枠線・寸法・文字)は、core を編集せずに上書き `src/config/lib/variantOverrides.config.ts` で差し替える。書いたクラスが cva の出力の後ろに結合され、同じプロパティは tailwind-merge で後勝ちする。各要素の `className` はさらにその後ろなので、個別指定は勝つ。

```ts
// src/config/lib/variantOverrides.config.ts
import type { VariantOverridesOverride } from "@/lib/variantOverrides";

export default {
  button: {
    base: "rounded-full shadow-none",      // 全 variant / size 共通
    variant: { outline: "border-2" },      // variant 単位
    size: { md: "h-11 px-5" },             // size 単位
  },
  badge: { size: { md: "px-2 py-0.5" }, solid: { base: "rounded-md" } },
} satisfies VariantOverridesOverride;
```

| キー | 対象 | variant / size 名の定義 |
|---|---|---|
| `button` | `Button` / `LinkButton` / `PseudoButton`(`buttonVariants` を使う全部品) | `src/components/Button/variants/button-variants.ts` |
| `tabletButton` | `TabletButton` | `src/components/Button/variants/tablet-button-variants.ts` |
| `badge.size` | `SolidBadge` / `SoftBadge` / `BookmarkTagBadge` 共通のサイズ | `src/components/Badge/badge-variants.ts` |
| `badge.solid` / `badge.soft` / `badge.bookmarkTag` | 各バッジの `base` / `variant` | 同上 |
| `booleanCheckbox` | `BooleanCheckboxInput` のチェックボックス(`base` / `size`) | 値の名前 = `@/lib/variantOverrides` の型(`CheckControlSize`)、既定のクラス = `src/components/Input/BooleanCheckboxInput.tsx` |
| `booleanRadioGroup` | `BooleanRadioGroupInput` の各ラジオ(`base` / `size`) | `CheckControlSize`、`BooleanRadioGroupInput.tsx` |
| `singleCardCheckbox` | `SingleCardCheckbox` のカード(`base` / `size` / `color`。`color` は今の色 = チェック時 `checkedVariant`・未チェック時 `uncheckedVariant` のときだけ) | `CheckControlSize`・`SingleCardCheckboxColor`、`SingleCardCheckbox.tsx` |
| `input` | 入力欄系(`Input` とその上の部品)と選ぶ欄の引き金(`SelectInput` / `ComboboxInput` / `MultiSelectInput` 系)で 1 つを共有(`base` / `size`) | `InputSize`、`src/components/Input/Input.tsx` の `INPUT_SIZE_CLASSES` |
| `stepperInput` | `StepperInput` の外枠(`base` / `size`。既定の高さは操作部品の高さの段) | `StepperInputSize`、`StepperInput.tsx` |
| `switchInput.track` / `switchInput.indicator` | `SwitchInput` の台(`base` / `size` / `activeColor` はオンの間・`inactiveColor` はオフの間)と丸(`base` / `size`) | `CheckControlSize`・`SwitchInputColor`、`SwitchInput.tsx` |
| `pageTitle` / `para` / `secTitle` / `span` | 各 TextBlocks(`base` / `tone` / `size` / `weight` / `align`。`srOnly` は上書きしない) | `TextTone`・`TextSize`・`TextWeight`・`TextAlign`、`src/components/TextBlocks/textVariants.ts` |

- 結合順: cva 出力 → `base` → 軸ごと(`variant[v]` → `size[s]`、入力部品・TextBlocks は表の軸の順)→ 要素の `className`
- 置き換えたいクラスと同じ修飾子を付ける(`hover:bg-primary/90` を変えるなら `hover:bg-primary/80`。`dark:` / `focus-visible:` も同様)
- 色はここではなく `palette.css` のトークンで変える(トークンなら全部品に効く)。ここは形の差し替え用
- キーと軸の値の名前は upstream が維持する契約(入力部品・TextBlocks の値の名前は `@/lib/variantOverrides` の型が持ち、部品の既定のクラスの表はそれに `satisfies` で揃える)。削除・改名時は `.notices` で通知する。upstream がキーを増やしても fork の設定は追記不要
- 仕組み: `@/lib/variantOverrides` の `createOverridableVariants(base, cvaConfig, override)`(cva と同じ引数・同じ返り値型。cva の variants の全ての軸を解決する)。状態で効き方が変わる軸(スイッチの色・カードの色)は部品が `variantOverrideClasses(override, { 軸: 値 })` で足す。cva を持つ棚の部品は全部この口を通す

### 生パレット色の禁止(ESLint)

- 対象: upstream 所有の UI(`src/components` / `src/lib` / `src/domains/core` / `src/domains/_template` / `src/app/**/_layout/`。`_layout` の `*.replace.tsx` は除く)。fork が足した lib(`src/lib/CATALOG.md` の自分の節)は 2 規則とも warn。fork 固有の UI は対象外。同じ規律を敷きたい fork は `eslint.config.mjs` の `files` にパスを足す
- `style-tokens/no-raw-palette`: `bg-slate-900` / `text-red-600` / `bg-white` / `text-[#fff]` のような生パレット色クラスを error にする。生パレット色はブランド色に追従せず `dark:` 併記が要り、fork が core を直す動機になるため
  - 代わり: 白黒は `bg-background` / `text-foreground` / `bg-card`、幕は `bg-overlay/50`、意味色は上の 3 変数
  - ブランドロゴ色など正当な例外は理由付き `// eslint-disable-next-line style-tokens/no-raw-palette -- 理由` で明示する
- `style-tokens/no-bare-semantic-text`: 同じ範囲で意味色の素の文字 `text-success` / `text-info` / `text-warning` / `text-destructive`(修飾子・透過率付きも)を error にする
  - 素の背景の文字は `text-x-text`、塗りの上の文字は `text-x-foreground`。クラス名ではない文字列(入力欄の例など)は理由付き eslint-disable で明示する

### config.css の値を変えたいとき

- `core/config.css` の管理画面余白トークン等は直下の fork のどのファイルからでも `:root { --admin-page-padding-inline: 2rem; }` で上書きできる。`config.css` 側が `@media (min-width: 40rem)` で値を切り替えているトークンは、同じメディアクエリも書くこと(無レイヤーの `:root` は全幅で勝つため)
- 枠の寸法変数(`--app-header-height` / `--app-banner-height` / `--app-bottom-nav-height` / `--app-safe-area-*`)の既定値も `config.css` の `:root` にある。一覧: `src/app/(user)/_layout/README.md` の「寸法の CSS 変数」
  - `--app-*-height` は UserLayout・AdminLayout が外枠の inline style で実値(実測か config の値)を書くので、fork のファイルから上書きしても効かない(値を変えるのは config の TS か部品の高さそのもの)
  - `--app-header-height` の初期値(今の行の高さ、外枠ごと・端末ごと)は `core/frame.css` にあり、測る前の最初の表示とページを移る間に効く。利用者の枠は測った値が inline で上書きする(行のクラスとの一致は `core/frameHeaderHeight.test.mjs`)
  - 管理の枠は測らない: 行の高さは `config.css` の `--admin-header-row-height`(SP 3.25rem / PC 5.5rem)1 か所で決まり、行(AdminHeader)と外枠の初期値の両方がそれを読む。ヘッダーを別の高さの部品に差し替えた fork は `overrides.css` でこの値を上書きする
  - `--app-safe-area-*`(端末の切り欠き = CSS の env() の safe-area-inset-*、無ければ 0px)は fork のファイルから上書きできる。viewport-fit=cover が既定(`src/app/_layout/config.ts の root の枠の viewport`)で、枠の部品はこの変数で端を避ける
  - env() を直接書くのは `config.css` の定義の 4 行だけ(部品・ページはこの変数を使う)。`config.css` に置いたのは、枠の外(Admin など)でも 0 の既定で参照できるようにするため。layout ごとに書くと枠の外では未定義になる

### Tier2 → Tier3 の重ね合わせ

`global.css` の `@import` 順がそのまま優先順位(`./core/index.css` は必ず最初)。Tier2 が `brand.css` を足して import し、Tier3 がさらに自分のファイルを後ろに足せば、Tier3 が勝つ。

### サイトテーマの設定(ライト / ダーク)

仕組みは [README.md](./README.md) の Internals「サイトテーマの仕組み」。

```ts
export default {
  storageKey: "theme",                                    // 保存キー(全エリア共通、既定 "theme")
  areas: [                                                // 先頭一致順。key 一致は部分更新、新規 key は末尾追加
    { key: "admin", match: ["/admin", "/debug"], mode: "light", switchable: true },
  ],
  fallback: { key: "user", mode: "light", switchable: false },   // どのエリアにも一致しないパス
} satisfies SiteThemeOverride;
```

- `mode`: `light` | `dark` | `system`(OS 設定に追従)
- `switchable: true` のエリアだけ保存値を参照し、切替ボタン(`useDarkModeSwitch` の `switchable`)が描画される
- `switchable: false` のエリアは保存値を一切見ない。管理画面でダークを選んでもユーザー側に漏れない
- 一致判定はセグメント境界(`/admin` は `/administer` に一致しない)
- 追加したエリアの書かなかった欄は `match: []`・`mode: "light"`・`switchable: false`。`{ key: "admin", $delete: true }` で既定のエリアを消せる(`@/lib/defineConfig` の配列の規則)

よくある設定:

```ts
{ fallback: { mode: "dark" } }                      // ユーザー側ダーク固定
{ fallback: { mode: "system", switchable: true } }  // OS 追従 + 利用者が切替可
{ areas: [{ key: "admin", switchable: false }] }    // 管理画面のスイッチを消す
{ areas: [{ key: "kiosk", match: ["/kiosk"], mode: "dark" }] }  // エリア追加
```

### 独自の切替 UI を作るとき

`useDarkModeSwitch()`(`@/lib/siteTheme`)の `isDark` / `switchable` / `toggle` で描く(`switchable` は usePathname ベースで SSR とクライアントで一致する。手本: 管理のヘッダー `src/app/admin/_layout/AdminHeader.default.tsx`)。値を直接決めるときは `useSiteThemeStore()` の `setDark`。ロックされたエリアでは `setDark` / `toggle` は何もしない(開発時は console.warn)。`<html>` を直接触らない。
