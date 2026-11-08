# src/styles — デザインの層と書く場所

この README は、見た目を変えたい人(upstream の開発者・fork の作業者)が「どこに何を書けば、どこまで変わるか」を引くための文書。upstream が構造(`core/`・部品・枠)を持ち、fork が値(直下の CSS・`src/config/ui/`)を持つ。fork は `core/` も core の部品も編集せずにデザインを変えられる。

## デザインの 2 原則

1. **アプリ全体でデザインを統一しやすい**: 色・角丸・影・書体は 1 か所(トークン)で変えれば全画面に効く。部品の形は型ごとに 1 か所(バリアントの上書き)で変わる
2. **個別の 1 ページが効率的かつ自由に構築できる**: 部品と余白の段は名前で選ぶだけで揃い(効率)、そのページだけの見た目は className で何でも書ける(自由)

2 つは引っ張り合う。全体を揃える仕組みが強すぎると 1 ページの自由が消え、自由に書きすぎると全体の統一が崩れる。下の地図は、変えたいことを「効く範囲」で並べ、届く層で変えることで両方を保つためのもの。

## 層の地図

効く範囲の広い順の 1 列。変えたいことは**それが届く層**で変え、下の層は上の層の値を使う(下の層で上の層の値を書き直さない)。

| 層 | 効く範囲 | 書く場所 | 原則 |
|---|---|---|---|
| 1. トークン | アプリ全体(全部品・全画面) | 直下の `palette.css` / `typography.css`(`:root` / `.dark` / `[data-area]`) | 原則 1 の中心 |
| 2. 部品の型ごとの設定 | その部品の型を使う全部の場所 | `src/config/ui/*.config.ts`(`variants.config.ts` のバリアントの上書き・`fonts.config.ts`・枠の config) | 原則 1 |
| 3. 枠 | その枠の全ページ(ユーザー / 管理 / LP) | 枠の差し替え(`src/app/<route>/_layout/` の README)・枠の config | 原則 1 |
| 4. ページ | その 1 ページ | `page.tsx` の 1 行スイッチ → `_components/<X>Screen.tsx`(src/lib/screens/README.md) | 原則 2 |
| 5. 部品の名前・余白の段 | その部品 1 つ | 部品と variant / size / `appearance` / 余白の prop を名前で選ぶ | 原則 2(効率) |
| 6. className | その要素 1 つ | `className`(Tailwind の数値・任意値) | 原則 2(自由) |
| (すき間) data-slot | 上流の枠・部品の内側で、className もバリアントも届かない所 | 直下の `overrides.css` の `[data-slot="<名前>"]` | 原則 1 のすき間埋め |

## 早見表(変えたいこと → 書くファイル)

まず 2 つを決める。

1. **どこまで変えたいか**: サイト全体 → トークン(層 1)。足りなければバリアントの上書き(層 2)。それでも手が届かない所だけ data-slot。**このページだけ** → className(層 6)
2. **その要素を自分のコードで書いているか**: 書いている(自分の Screen・`_components/`・fork の部品)→ className かバリアント。上流の枠や部品の内側(className を渡せない)→ data-slot

| 変えたいこと | 書くファイル | 1 行の例 | 動く範囲 |
|---|---|---|---|
| ブランド色・背景色 | `palette.css` | `:root { --primary: oklch(0.6 0.2 255); }` | 全部品・全画面(メールは `:root` だけ読む) |
| ユーザー側だけの色 | `palette.css` | `[data-area="user"] { --primary: ...; }` | ユーザー側の全画面 |
| 意味色(成功・警告など)の塗り / 文字 | `palette.css` | `:root { --success: ...; --success-text: ...; }` | 塗りと素の背景の文字を別々に |
| 角丸 | `palette.css` | `:root { --radius: 1rem; }` | `rounded-sm/md/lg/xl` の全部 |
| カード等の影(appearance ごと) | `palette.css` | `:root { --appearance-shadow-raised: 0 8px 24px rgb(0 0 0 / 0.2); }` | その appearance を使う全 Layout 部品 |
| Tailwind の影の段・イージング | `typography.css` か `overrides.css` の `@theme` | `@theme { --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.1); }` | `shadow-sm` 等の全部 |
| 書体(Web フォント) | `src/config/ui/fonts.config.ts` | `defineFontsConfig({ sans })` | 全画面 |
| 書体(system の並び)・流体文字サイズ | `typography.css` | `:root { --font-geist-sans: ...; }` | 全画面 |
| ボタン・バッジの形(角丸・枠線・寸法) | `src/config/ui/variants.config.ts` | `button: { base: "rounded-full" }` | その部品の全部 |
| ライト / ダークの既定・切替 | `src/config/ui/site-theme.config.ts` | `fallback: { mode: "dark" }` | エリアごと |
| 枠の中身(メニュー・リンク・幅) | `src/config/ui/user-*.config.ts` ほか | (各 config の冒頭) | その枠 |
| 枠そのもの | 枠の差し替え | (user)/_layout・admin/_layout・(marketing)/_layout の README | その枠の全ページ |
| LP に共通の枠(既定は枠なし) | `src/app/(marketing)/_layout/MarketingLayout.replace.tsx` | (marketing)/_layout の README | (marketing) の全ページ |
| 1 ページの組み方 | `_components/<X>Screen.tsx` | (src/lib/screens/README.md) | その 1 ページ |
| 1 要素の見た目 | その要素の `className` | `className="mt-6 text-lg"` | その要素だけ |
| 上流の枠・部品の内側の 1 か所 | `overrides.css` | `[data-slot="header-shell"] { padding-inline: 1.5rem; }` | その印の付いた全要素 |
| 要素の既定(`body`・`a`・`::selection`)・`@keyframes` | `overrides.css` | `::selection { background: var(--primary); }` | 全画面 |
| 管理画面の余白などの寸法トークン | どの直下ファイルでも | `:root { --admin-page-padding-inline: 2rem; }` | 管理画面 |

書かなければ upstream の既定値で動く。upstream がトークンや設定キーを足しても、fork は何も追記しなくてよい。

## 勝ち順

同じ要素の同じプロパティを 2 か所で書いたときにどちらが効くか。筋は 2 本ある。

- **TS の筋**(クラスの文字列): cva の既定 → `variants.config.ts` のバリアントの上書き → 要素の `className`。後ろが勝つ(tailwind-merge で同じプロパティを置き換える)
- **CSS の筋**: 直下の fork のファイル(`palette.css` / `typography.css` / `overrides.css` と fork が足したもの)は Tailwind の `@layer` の外(無レイヤー)で読まれる。無レイヤーの CSS は utilities 層より常に強いので、**`overrides.css` に書いた規則は同じプロパティの `className` に勝つ**

### fork の CSS が狙ってよいもの(約束)

- `[data-slot="<名前>"]` の印と、`:root` / `.dark` / `[data-area]` の変数の値だけ
- id・class 名・`data-component`・DOM の形(子の順番・入れ子)は約束ではない。upstream は notice なしに変えることがある
- 約束の外を狙う CSS は禁止ではないが、**保証しない・notice も出ない**(壊れたら fork が直す)

### data-slot の付け方(upstream が部品を作るとき)

- 原則: **className を渡せない所**(枠の部位・部品の内側)にだけ付ける。className を渡せる所は className とバリアントで足りる
- 便宜上、className も data-slot も持つ要素がある。そこでは**常に data-slot(fork の CSS)が勝つ**(無レイヤーだから)。上流の画面がその要素に className で書いた値も、fork の data-slot の規則が上書きする
- 両方を持つ要素の一覧(今): `main`(Layout/Main)・`page-title`(TextBlocks/PageTitle の h1)・`sec-title`(TextBlocks/SecTitle)・`admin-sec-title`(管理画面の SecTitle)
- この一覧に足す条件(3 つすべて): className を渡せる要素である / fork がサイト全体で揃えたい実例がある / バリアントの上書きの口では受けられない
- 印の名前 = その要素を描く部品(または部位)の名前の kebab(`popover-content`・`header-shell`)。印の一覧は各部品・枠の README(枠 = `src/app/(user)/_layout/README.md` と `src/app/admin/_layout/README.md`)。一覧とコードの一致は印の一覧の検査で確かめる。印を消す・名前を変えるのは notice

## トークンで動く範囲

トークン(と `variants.config.ts`)を変えたときに動く所と動かない所。

| 種類 | 動く | 動かない |
|---|---|---|
| 色(`--primary` 等) | トークンを使う全クラス(`bg-primary`・`text-success-text` …)と、それを参照するグラデーション・影 | 生パレット色(lint で禁止)・任意値の色 |
| 角丸(`--radius`) | `rounded-sm/md/lg/xl` | `rounded-[12px]` などの任意値 |
| appearance の影(`--appearance-shadow-*`) | Layout 部品の `appearance`(raised / outlined / frosted / soft / radiant) | `shadow-sm` 等の Tailwind の影の段(それは `@theme` の `--shadow-*`)・className の `shadow-[...]` |
| 部品の形(`variants.config.ts`) | その部品の variant / size の全部 | 要素の `className`(上書きより後ろで勝つ) |
| 余白 | (余白の段のトークンはまだ無い。入ったときに動くのは Layout の余白 prop だけ) | 部品の内側の余白(size のバリアントで変える)・className の数値(`p-4` 等。固定) |

## ファイルと所有権

```
src/styles/
├── global.css              下流      入口。最初に ./core/index.css、その後に下の 4 ファイル(fork のファイルはこの後に足す)
├── palette.css             下流      変えたい色だけ書く(出荷時はこの README を指す 1 行のコメントだけ)
├── typography.css          下流      変えたい書体・サイズだけ書く(同上)
├── overrides.css           下流      要素の既定・@keyframes・data-slot の規則(同上)
├── gradient.css            下流      このリポのグラデーション。pnpm generate styles が src/config/app/gradients.config.ts から生成(手で書かない。出荷時は空)
├── README.md               upstream  このファイル(所有はファイル単位)
└── core/                   upstream  ★ fork は編集しない(値の変更は直下のファイルで上書き)
    ├── index.css           upstream  @layer の順序・tailwindcss・tw-animate-css と upstream の CSS の import だけ
    ├── theme.css           upstream  @theme inline のトークン構造、@custom-variant、color-scheme。値は書かない
    ├── palette.default.css      upstream  :root / .dark の色と appearance の影の既定値(値だけ)
    ├── typography.default.css   upstream  書体スタックの既定値(--font-geist-sans/mono、loaded 変数へフォールバック参照)
    ├── config.css          upstream  レイアウト系トークン(幅・管理画面余白・枠の寸法)
    ├── z-layer.css         upstream  z-index トークン
    ├── gradient.default.css     upstream  pnpm generate styles で生成(上流の既定 src/lib/gradient/tokens.base.ts と角度ユーティリティ。fork でも上流と同じ中身)
    ├── frame.css           upstream  枠の部位を隠す・fill の規則(手書き。外枠の属性 data-frame-hide / data-frame-fill を読む)
    ├── animations.css / base.css / components.css / utilities.css / admin.css   upstream
    └── styleTokens.test.mjs      upstream  pnpm test src/styles/core/
```

- upstream は直下の `global.css` / `palette.css` / `typography.css` / `overrides.css` / `gradient.css` を初回作成後に編集しない。説明は fork 所有のファイルに書かず、この README か `.claude/rules/core/style.md` に書く。fork が直下に足した CSS も fork の物
- グラデーションは既定と実効の対: `pnpm generate styles` が上流の既定を `core/gradient.default.css` に、そのリポの分(`src/config/app/gradients.config.ts`)を直下の `gradient.css` に書く。fork が自分の分を足して再生成するのは正しい使い方(手で編集しない)。`core/` の下に fork の差分は出ない。同じ key を書けば直下の分が後から読まれて上書きする
- 名前の印: `core/` = upstream の物(`src/features/core/` と同じ印)、`<名前>.default.css` = 上流の既定、印なし = そのリポの実効(直下の `palette.css` 等)
- 置き場の経緯: docs/journal/2026-11-04--next-starter--styles-readme-history.md

upstream 側のファイルの役割(upstream でスタイルを足すときの置き場所):

- `@import "tailwindcss"` は `core/index.css` の 1 か所だけ。upstream の CSS は `core/index.css` 経由で読まれるので個別に import しない(プラグインも `core/index.css` にまとめる)。upstream が CSS を足すときも `core/index.css` に import を足す(fork 所有の `global.css` は触らない)
- `animations.css`: `--animate-*` の宣言と、対応する `@keyframes` を同じファイルに書く
- `base.css`: リセットと HTML 要素の基本スタイルだけ。ページ固有のスタイルは書かない
- `components.css` / `admin.css`: 再利用する UI パターンを `@layer components` に(`admin.css` は管理画面専用)。先にコンポーネントの variant で表現できないかを検討する
- `utilities.css`: Tailwind のユーティリティで表現しづらい 1 プロパティ完結のクラス

## 層ごとの書き方

### 色の正は CSS

色の唯一の正は `core/palette.default.css`(既定)と直下の `palette.css`(上書き)。派生物はそこから生成する:

- メール用 hex 定数: `pnpm generate styles`(両ファイルの `:root` を合成して `src/features/core/mail/constants/colors.ts` を生成。欠落があれば失敗する)。色を変えたら必ず実行してコミットする。メールはダークモードもエリアも持たないので `.dark` と `[data-area]` は読まない。ブランド色を `[data-area="user"]` にだけ書くとメールは汎用色のままになる。メールにも反映したい色は `:root` にも書くこと
- gradient トークン: `pnpm generate styles`(`tokens.base.ts` → `core/gradient.default.css`、`src/config/app/gradients.config.ts` → 直下の `gradient.css`。palette には依存しない)

枠の部位を隠す規則: `core/frame.css`(手書きの静的な規則。各ルートの枠の宣言(`frame.default.ts` / `frame.ts`)を UserLayout が外枠の属性にし、その属性で部位を隠す)。色・値は持たない(規則だけ)ので fork のファイルからの上書きは想定しない。部位の一覧との一致は `pnpm test 'src/app/(user)/_layout/'`。仕組みは src/app/(user)/_layout/README.md「枠の部位を隠す・fill(枠の宣言)」

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

- 変数名と既定値の一覧は `core/palette.default.css`
- `data-area` は `<html>` に付く(root layout が SSR 付与)。値は `site-theme.config.ts` のエリア key(既定: `user` / `admin`)
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

- 汎用の影の段(`shadow-sm` 等)は Tailwind の `--shadow-*` で、これとは別(次節)
- `appearance.ts` に影の値を直書きしない。影をブランド色に追従させたいときは値に `color-mix(in oklch, var(--primary) 20%, transparent)` を書く(既定の radiant がこの形)
- トークンの値は `<html>`(`:root` / `.dark` / `[data-area]` の付く要素)で計算される。`--primary` を `<html>` より下の要素で変えても、影の中の `var(--primary)` は追従しない

### 書体(fonts.config.ts と typography.css)

書体は 2 段構え。既定では Web フォントを読み込まず system スタックで表示する。

| やりたいこと | 書く場所 |
|---|---|
| Web フォントを読み込む(Google Fonts / ローカルファイル) | `src/config/ui/fonts.config.ts`(next/font) |
| Web フォントは使わず system フォントの並びを変える | `typography.css` の `--font-geist-sans` |
| 文字サイズ(流体サイズ等)を変える | `typography.css` の `@theme` |

仕組み: next/font のローダーを `variable: "--font-sans-loaded"`(mono は `"--font-mono-loaded"`)で呼び `defineFontsConfig({ sans })` に渡すと、root layout が `<html>` にクラスを当ててその変数を定義する。`typography.default.css` のスタックは `--font-geist-sans: var(--font-sans-loaded, "Inter", system-ui, ...)` と書かれているので、読み込まれていればそれを、無ければ system スタックを使う。theme.css と Tailwind の `font-sans` / `font-mono` は一切変えない。

```ts
// src/config/ui/fonts.config.ts
import { Noto_Sans_JP } from "next/font/google";
import { defineFontsConfig } from "@/lib/fonts";
const sans = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans-loaded", display: "swap" });
export const FONTS_CONFIG = defineFontsConfig({ sans });
```

next/font の制約: ローダーはモジュールのトップレベルで、引数はリテラル(変数や import 定数は不可)。`variable` 名は上の固定文字列をそのまま書く。別名を書いても型や実行時では検知できず黙って効かなくなるため、`pnpm test src/lib/fonts/fonts.test.mjs` が `fonts.config.ts` のソースを静的に検査する。Google Fonts はビルド時に取得されセルフホスト化される(実行時に Google への通信は発生しない)。next/font は Next のコンパイラ外(scripts/ や node --test)では動かないので、ローダーを追加した後は `fonts.config.ts` を Next 外から import しない。

```css
/* src/styles/typography.css */
:root {
  --font-geist-sans: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;  /* system フォントの並びだけ変える */
}
@theme {
  --text-fluid-5xl: clamp(2.5rem, 6vmin, 4rem);   /* theme.css の流体サイズを同名で上書き */
}
```

注意: `typography.css` で `--font-geist-sans` を上書きすると、その値が `fonts.config.ts` で読み込んだ Web フォントより優先される(loaded 変数への参照を自分で消すことになる)。両方使う場合は `var(--font-sans-loaded, ...)` を含めて書く。

メールテンプレートの書体は別系統(各テンプレートの inline `fontFamily`、メールクライアント向けの system スタック)で、この設定の影響を受けない。

### 角丸・Tailwind の影の段・イージング

```css
/* 角丸: --radius は palette.default.css が無レイヤーの :root で定義しているので、同じ :root で上書きする
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

判断基準: `palette.default.css` / `config.css` / `z-layer.css` に `:root { --x }` として定義済みの変数(`--appearance-shadow-*` を含む)は `:root` で、それ以外の Tailwind 名前空間(`--shadow-*` / `--ease-*` / `--text-*` / `--animate-*` 等)は `@theme` で上書きする。

### overrides.css(要素の既定・data-slot)

- 書くもの: 要素の既定(`body`、`a`、`::selection`、scrollbar)、`@keyframes`、`[data-area="admin"] body { ... }` のようなエリア単位の全体調整、上流の枠・部品の内側への `[data-slot="<名前>"]` の規則
- 無レイヤーなので、同じプロパティの className より常に勝つ(勝ち順)。ボタンやバッジの形は data-slot ではなく `variants.config.ts` で変える(variant / size ごとに変えられ、className の個別指定も残る)

### バリアントの上書き(variants.config.ts)

Button / Badge の形(角丸・影・枠線・寸法)は、core を編集せずに `src/config/ui/variants.config.ts` で差し替える。書いたクラスが cva の出力の後ろに結合され、同じプロパティは tailwind-merge で後勝ちする。各要素の `className` はさらにその後ろなので、個別指定は勝つ。

```ts
// src/config/ui/variants.config.ts
import { defineVariantOverrides } from "@/lib/variantOverrides";
export const VARIANT_OVERRIDES = defineVariantOverrides({
  button: {
    base: "rounded-full shadow-none",      // 全 variant / size 共通
    variant: { outline: "border-2" },      // variant 単位
    size: { md: "h-11 px-5" },             // size 単位
  },
  badge: { size: { md: "px-2 py-0.5" }, solid: { base: "rounded-md" } },
});
```

| キー | 対象 | variant / size 名の定義 |
|---|---|---|
| `button` | `Button` / `LinkButton` / `PseudoButton`(`buttonVariants` を使う全部品) | `src/components/Form/Button/button-variants.ts` |
| `tabletButton` | `TabletButton` | `src/components/Form/Button/tablet-button-variants.ts` |
| `badge.size` | `SolidBadge` / `SoftBadge` / `BookmarkTagBadge` 共通のサイズ | `src/components/Badge/badge-variants.ts` |
| `badge.solid` / `badge.soft` / `badge.bookmarkTag` | 各バッジの `base` / `variant` | 同上 |

- 結合順: cva 出力 → `base` → `variant[v]` → `size[s]` → 要素の `className`
- 置き換えたいクラスと同じ修飾子を付ける(`hover:bg-primary/90` を変えるなら `hover:bg-primary/80`。`dark:` / `focus-visible:` も同様)
- 色はここではなく `palette.css` のトークンで変える(トークンなら全部品に効く)。ここは形の差し替え用
- キーと variant / size 名は upstream が維持する契約。削除・改名時は `.notices` で通知する。upstream がキーを増やしても fork の設定は追記不要
- 仕組み: `@/lib/variantOverrides` の `createOverridableVariants(base, cvaConfig, override)`(cva と同じ引数・同じ返り値型)。新しい部品にも同じ 1 関数で配線する

### 生パレット色の禁止(ESLint)

upstream 所有の UI(`src/components` / `src/lib` / `src/features/core` / `src/features/_template`)では `bg-slate-900` / `text-red-600` / `bg-white` / `text-[#fff]` のような生パレット色クラスを ESLint(`style-tokens/no-raw-palette`)が error にする(fork 固有の UI は対象外。同じ規律を敷きたい fork は `eslint.config.mjs` の `files` にパスを足す)。あわせて `src/components` 外からの `_shadcn` 直接 import も error(`no-restricted-imports`、対応表は `src/components/_shadcn/README.md`)。生パレット色はブランド色に追従せず `dark:` 併記が要り、fork が core を直す動機になるため。白黒は `bg-background` / `text-foreground` / `bg-card`、幕は `bg-overlay/50`、意味色は上の 3 変数で書く。ブランドロゴ色など正当な例外は理由付き `// eslint-disable-next-line style-tokens/no-raw-palette -- 理由` で明示する。

### config.css の値を変えたいとき

`core/config.css` の管理画面余白トークン等は直下の fork のどのファイルからでも `:root { --admin-page-padding-inline: 2rem; }` で上書きできる。`config.css` 側が `@media (min-width: 40rem)` で値を切り替えているトークンは、同じメディアクエリも書くこと(無レイヤーの `:root` は全幅で勝つため)。

枠の寸法変数(`--app-header-height` / `--app-banner-height` / `--app-bottom-nav-height` / `--app-safe-area-*`)の既定値も `config.css` の `:root` にある。`--app-*-height` は UserLayout・AdminLayout が外枠の inline style で実値(実測か config の値)を書くので、fork のファイルから上書きしても効かない(値を変えるのは config の TS か部品の高さそのもの)。`--app-header-height` の初期値(今の行の高さ、外枠ごと・端末ごと)は `core/frame.css` にあり、測る前の最初の表示とページを移る間に効く。利用者の枠は測った値が inline で上書きする(行のクラスとの一致は `core/frameHeaderHeight.test.mjs`)。管理の枠は測らない: 行の高さは `config.css` の `--admin-header-row-height`(SP 3.25rem / PC 5.5rem)1 か所で決まり、行(AdminHeader)と外枠の初期値の両方がそれを読む。ヘッダーを別の高さの部品に差し替えた fork は `overrides.css` でこの値を上書きする。`--app-safe-area-*`(端末の切り欠き = CSS の env() の safe-area-inset-*、無ければ 0px)は fork のファイルから上書きできる。viewport-fit=cover が既定(`src/app/_layout/config.ts の root の枠の viewport`)で、枠の部品はこの変数で端を避ける。env() を直接書くのは `config.css` の定義の 4 行だけ(部品・ページはこの変数を使う)。`config.css` に置いたのは、枠の外(Admin など)でも 0 の既定で参照できるようにするため。layout ごとに書くと枠の外では未定義になる。一覧: `src/app/(user)/_layout/README.md` の「寸法の CSS 変数」

### Tier2 → Tier3 の重ね合わせ

`global.css` の `@import` 順がそのまま優先順位(`./core/index.css` は必ず最初)。Tier2 が `brand.css` を足して import し、Tier3 がさらに自分のファイルを後ろに足せば、Tier3 が勝つ。

## サイトテーマ(ライト / ダーク)

### 仕組み

| 段階 | 場所 | 役割 |
|---|---|---|
| SSR | `src/app/layout.tsx` | `x-pathname`(proxy.ts 付与)からエリアを判定し `<html class="dark" data-area="...">` を出力。初回描画がエリアの既定で確定する |
| bootstrap | 同 layout の `<head>` 内 inline script | localStorage の保存値と OS 設定を body 描画前に反映(フラッシュ防止)。`@/lib/siteTheme/bootstrapScript.ts` が設定を埋め込んで生成 |
| クライアント | `SiteThemeSync`(`src/components/Fanctional`、root layout に常駐) | クライアント遷移・切替操作・OS 設定変化のたびに再解決して `<html>` を更新する唯一の書き手 |
| 判定ロジック | `@/lib/siteTheme`(純関数) | 上の 3 箇所が同じ判定を共有する。bootstrap script は手書き JS だが `pnpm test src/lib/siteTheme/siteTheme.test.mjs` が同一ケース集で一致を検証 |
| 設定 | `src/config/ui/site-theme.config.ts`(下流所有) | `defineSiteThemeConfig({ ...差分 })`。既定値は `@/lib/siteTheme/defaults.ts` |

### 設定の意味

```ts
defineSiteThemeConfig({
  storageKey: "theme",                                    // 保存キー(全エリア共通、既定 "theme")
  areas: [                                                // 先頭一致順。key 一致は部分更新、新規 key は末尾追加
    { key: "admin", match: ["/admin", "/debug"], mode: "light", switchable: true },
  ],
  fallback: { key: "user", mode: "light", switchable: false },   // どのエリアにも一致しないパス
});
```

- `mode`: `light` | `dark` | `system`(OS 設定に追従)
- `switchable: true` のエリアだけ保存値を参照し、`DarkModeSwitch` が描画される
- `switchable: false` のエリアは保存値を一切見ない。管理画面でダークを選んでもユーザー側に漏れない
- 一致判定はセグメント境界(`/admin` は `/administer` に一致しない)

よくある設定:

```ts
defineSiteThemeConfig({ fallback: { mode: "dark" } });                      // ユーザー側ダーク固定
defineSiteThemeConfig({ fallback: { mode: "system", switchable: true } });  // OS 追従 + 利用者が切替可
defineSiteThemeConfig({ areas: [{ key: "admin", switchable: false }] });    // 管理画面のスイッチを消す
defineSiteThemeConfig({ areas: [{ key: "kiosk", match: ["/kiosk"], mode: "dark" }] });  // エリア追加
```

### 表示と保存の分離

`src/utils/siteTheme.ts` は DOM 適用(`applyThemeToDom`)と保存(`persistThemePreference`)を分けている。保存は利用者が `DarkModeSwitch` を押したときだけ。固定エリアの適用や OS 追従で保存値を汚さない。

### 独自の切替 UI を作るとき

`useSiteThemeStore()`(`@/stores/siteTheme`)の `isDark` / `switchable` / `toggle` / `setDark` を使う。表示可否は `resolveSiteThemeArea(SITE_THEME_CONFIG, usePathname()).switchable` で判定する(`DarkModeSwitch` の実装がそのまま手本。SSR とクライアントで一致させるため usePathname ベース)。ロックされたエリアでは `setDark` / `toggle` は何もしない(開発時は console.warn)。`<html>` を直接触らない。

## デプロイ後の確認(Vercel ビルドキャッシュ)

Vercel が前回デプロイのビルドキャッシュを復元すると、キャッシュ作成後に `global.css` / `core/index.css` へ足された `@import` 先が、出力 CSS から黙って抜けることがある。ローカル dev とローカル `next build` は正常で、本番だけ崩れる。

- **症状**: パレット・角丸・書体が一斉に失われる(`--primary` / `--radius` / `--font-geist-sans` が未定義)。崩れた本番の CSS チャンク(`/_next/static/**/*.css`)を取得して `--primary:` を grep すると無い。ビルドログに `Restored build cache from previous deployment` がある
- **起きやすい状況**: デプロイ頻度の低い fork が、CSS ファイルを足す上流 notice(palette.default.css / typography.default.css の導入、`core/` への入れ替えなど)を何件もまとめて取り込んだ直後の初回デプロイ
- **ガード**: `pnpm build` の末尾の門 `pnpm check --gate=build:post` で `pnpm check styles` が走り、`global.css` から辿れる全ファイルの CSS 変数が `.next/static/**/*.css` に揃っていなければビルドを落とす(本番に出る前に止まる)。Vercel の Build Command が `pnpm build` 以外だと走らない
- **直し方**: キャッシュを使わずに再デプロイする。`pnpm live -- --prod --force`、またはダッシュボードの Redeploy で「Use existing Build Cache」を外す、または環境変数 `VERCEL_FORCE_NO_BUILD_CACHE=1` を一時的に置いて再デプロイし成功後に外す。キャッシュを常時無効にはしない(Hobby プランはビルド CPU が逼迫する)
- **運用ルール**: CSS ファイルを足す・構成を変える notice を取り込んだ後の初回本番デプロイは、ガードの有無にかかわらずキャッシュ無しで行う
- **目印の変数**: `@theme` の外に変数を持たない upstream のファイル(`core/` の theme / animations / base / components / admin)は、固有の目印 `--styles-marker-<名前>: 1`(枠の規則 frame.css は `--styles-marker-frame`)を宣言して検査対象にしている。`core/` に CSS を足すときも、固有の変数が無ければ目印を 1 つ置く
- **ガードの限界**: 他のファイルが宣言している名前だけを上書きするファイル(`palette.css` で `--primary` だけ変える等)は、抜けても名前が残るので検出できない(警告のみ)。fork 独自の変数(例 `--brand-accent`)を 1 つ宣言すれば検査対象になる。`@theme` 内の変数と `@utility` の中身は出力に残る保証が無いため検査しない

## テスト

| コマンド | 内容 |
|---|---|
| `pnpm check styles` | ビルド済み CSS に global.css から辿れる全ファイルの変数が揃っているか(`pnpm build` が自動で実行) |
| `pnpm test scripts/structure/styles/builtCss.test.mjs` | 上記の判定ロジック(@theme / @utility の除外、相対 import の走査、missing / unverifiable の判定) |
| `pnpm test src/lib/siteTheme/siteTheme.test.mjs` | 既定値の互換、エリア一致、ロック、bootstrap script と resolver の一致 |
| `pnpm test src/styles/core/` | theme.css の参照変数が上流 CSS で全て定義されている / `.dark` が `:root` に無い変数を持ち込まない / 意味色の 3 変数が揃っている / 書体変数が typography.default.css にある / `core/index.css` と `global.css` の import 順 / upstream が出荷する直下の 3 ファイルはコメントだけ(upstream のみ) |
| `pnpm test src/lib/fonts/fonts.test.mjs` | defineFontsConfig の既定(読み込み無し)と variable クラス連結、typography.default.css の loaded 変数参照 |
| `pnpm test src/lib/cn/cn.test.mjs` | theme.css の `--text-*` と tailwind-merge 登録のドリフト |
| `pnpm test src/lib/variantOverrides/variantOverrides.test.mjs` | オーバーライド無しで cva と同一出力 / 結合順(cva → オーバーライド → className)/ 既定 variant の解決 / 出荷時の variants.config.ts が空 |
| `pnpm test eslint-rules/style-tokens.test.mjs` | 生パレット色検出規則の検出・非検出ケース |

直下の fork のファイルは中身を検証しない(fork が自由に書く場所。入口の形と出荷時の中身だけを upstream で見る)。
