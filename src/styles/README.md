# src/styles — デザインの層と書く場所

## Overview

- この README は、見た目を変えたい人(upstream の開発者・fork の作業者)が「どこに何を書けば、どこまで変わるか」を引くための文書。upstream が構造(`core/`・部品・枠)を持ち、fork が値(直下の CSS・`src/config/ui/`)を持つ。fork は `core/` も core の部品も編集せずにデザインを変えられる。
- 層ごとの書き方(色・影・書体・角丸・overrides.css・バリアントの上書き・lint・config.css・Tier の重ね合わせ・サイトテーマの設定)は [Extension.md](./Extension.md)

### デザインの 2 原則

1. **アプリ全体でデザインを統一しやすい**: 色・角丸・影・書体は 1 か所(トークン)で変えれば全画面に効く。部品の形は型ごとに 1 か所(バリアントの上書き)で変わる
2. **個別の 1 ページが効率的かつ自由に構築できる**: 部品と余白の段は名前で選ぶだけで揃い(効率)、そのページだけの見た目は className で何でも書ける(自由)

2 つは引っ張り合う。全体を揃える仕組みが強すぎると 1 ページの自由が消え、自由に書きすぎると全体の統一が崩れる。下の地図は、変えたいことを「効く範囲」で並べ、届く層で変えることで両方を保つためのもの。

### 層の地図

効く範囲の広い順の 1 列。変えたいことは**それが届く層**で変え、下の層は上の層の値を使う(下の層で上の層の値を書き直さない)。

| 層 | 効く範囲 | 書く場所 | 原則 |
|---|---|---|---|
| 1. トークン | アプリ全体(全部品・全画面) | 直下の `palette.css` / `typography.css`(`:root` / `.dark` / `[data-area]`) | 原則 1 の中心 |
| 2. 部品の型ごとの設定 | その部品の型を使う全部の場所 | `src/config/lib/<名前>.config.ts`(`variantOverrides.config.ts` のバリアントの上書き・`fonts.config.ts`) | 原則 1 |
| 3. 枠 | その枠の全ページ(ユーザー / 管理 / LP) | 枠の差し替え(`src/app/<route>/_layout/` の README)・枠の config | 原則 1 |
| 4. ページ | その 1 ページ | `page.tsx` の 1 行スイッチ → `_components/<X>Screen.tsx`(src/lib/screens/README.md) | 原則 2 |
| 5. 部品の名前・余白の段 | その部品 1 つ | 部品と variant / size / `appearance` / 余白の prop を名前で選ぶ | 原則 2(効率) |
| 6. className | その要素 1 つ | `className`(Tailwind の数値・任意値) | 原則 2(自由) |
| (すき間) data-slot | 上流の枠・部品の内側で、className もバリアントも届かない所 | 直下の `overrides.css` の `[data-slot="<名前>"]` | 原則 1 のすき間埋め |

## Usage

### 早見表(変えたいこと → 書くファイル)

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
| 書体(Web フォント) | `src/config/lib/fonts.ui.config.ts` | `export default { sans } satisfies FontsOverride` | 全画面 |
| 書体(system の並び)・流体文字サイズ | `typography.css` | `:root { --font-geist-sans: ...; }` | 全画面 |
| ボタン・バッジの形(角丸・枠線・寸法) | `src/config/lib/variantOverrides.config.ts` | `button: { base: "rounded-full" }` | その部品の全部 |
| ライト / ダークの既定・切替 | `src/config/lib/siteTheme.config.ts` | `fallback: { mode: "dark" }` | エリアごと |
| 枠の中身(メニュー・リンク・幅・背景) | 枠の設定の上書き `src/config/layout/<枠>.config.ts`・`<枠>.ui.config.ts` | (各上書きファイルの冒頭) | その枠 |
| 枠そのもの | 枠の差し替え | (user)/_layout・admin/_layout・(marketing)/_layout の README | その枠の全ページ |
| LP に共通の枠(既定は枠なし) | `src/app/(marketing)/_layout/MarketingLayout.replace.tsx` | (marketing)/_layout の README | (marketing) の全ページ |
| 1 ページの組み方 | `_components/<X>Screen.tsx` | (src/lib/screens/README.md) | その 1 ページ |
| 1 要素の見た目 | その要素の `className` | `className="mt-6 text-lg"` | その要素だけ |
| 上流の枠・部品の内側の 1 か所 | `overrides.css` | `[data-slot="header-shell"] { padding-inline: 1.5rem; }` | その印の付いた全要素 |
| 要素の既定(`body`・`a`・`::selection`)・`@keyframes` | `overrides.css` | `::selection { background: var(--primary); }` | 全画面 |
| 管理画面の余白などの寸法トークン | どの直下ファイルでも | `:root { --admin-page-padding-inline: 2rem; }` | 管理画面 |

書かなければ upstream の既定値で動く。upstream がトークンや設定キーを足しても、fork は何も追記しなくてよい。

### 勝ち順

同じ要素の同じプロパティを 2 か所で書いたときにどちらが効くか。筋は 2 本ある。

- **TS の筋**(クラスの文字列): cva の既定 → `variants.config.ts` のバリアントの上書き → 要素の `className`。後ろが勝つ(tailwind-merge で同じプロパティを置き換える)
- **CSS の筋**: 直下の fork のファイル(`palette.css` / `typography.css` / `overrides.css` と fork が足したもの)は Tailwind の `@layer` の外(無レイヤー)で読まれる。無レイヤーの CSS は utilities 層より常に強いので、**`overrides.css` に書いた規則は同じプロパティの `className` に勝つ**

### fork の CSS が狙ってよいもの(約束)

- `[data-slot="<名前>"]` の印と、`:root` / `.dark` / `[data-area]` の変数の値だけ
- id・class 名・`data-component`・DOM の形(子の順番・入れ子)は約束ではない。upstream は notice なしに変えることがある
- 約束の外を狙う CSS は禁止ではないが、**保証しない・notice も出ない**(壊れたら fork が直す)

## Extension

- 層ごとの書き方とサイトテーマの設定: [Extension.md](./Extension.md)

## Internals

### ファイルと所有権

直下(下流の物):

- `global.css`: 入口。最初に `./core/index.css`、その後に下の 5 ファイル(fork のファイルはこの後に足す)
- `palette.css`: 変えたい色だけ書く(出荷時はこの README を指す 1 行のコメントだけ)
- `typography.css`: 変えたい書体・サイズだけ書く(同上)
- `overrides.css`: 要素の既定・@keyframes・data-slot の規則(同上)
- `gradient.css`: このリポのグラデーション。`pnpm generate styles` が `src/config/lib/gradient.config.ts` から生成(手で書かない。出荷時は空)
- `z-layer.css`: このリポが足した重なりの層。`pnpm generate styles` が `src/config/lib/zLayer.config.ts` の layers から生成(手で書かない。出荷時は空。global.css が読む)
- `README.md` は upstream の物(所有はファイル単位)

`core/`(upstream の物。fork は編集しない。値の変更は直下のファイルで上書き):

- `index.css`: @layer の順序・tailwindcss・tw-animate-css と upstream の CSS の import だけ
- `theme.css`: @theme inline のトークン構造、@custom-variant、color-scheme。値は書かない
- `palette.css`: :root / .dark の色と appearance の影の既定値(値だけ)
- `typography.css`: 書体スタックの既定値(--font-geist-sans/mono、loaded 変数へフォールバック参照)
- `config.css`: レイアウト系トークン(幅・管理画面余白・枠の寸法)
- `z-layer.css`: z-index トークン(層の名の TS の側 = src/lib/zLayer。名を足す・消すときは両方。zLayer.test.ts が突き合わせる)
- `gradient.css`: `pnpm generate styles` で生成(上流の既定 src/lib/gradient/tokens.base.ts と角度ユーティリティ。fork でも上流と同じ中身)
- `frame.css`: 枠の部位を隠す・fill の規則(手書き。外枠の属性 data-frame-hide / data-frame-fill を読む)
- `animations.css` / `base.css` / `components.css` / `utilities.css` / `admin.css`: 下の「upstream 側のファイルの役割」
- `styleTokens.test.mjs`: `pnpm test src/styles/core/`

- upstream は直下の `global.css` / `palette.css` / `typography.css` / `overrides.css` / `gradient.css` を初回作成後に編集しない。例外は入口の `@import` の行を足すときだけ: 上流の `global.css` を直し、notice で fork に同じ 1 行を足させる(直下の生成物 `gradient.css`・`z-layer.css` の読み込み)。fork が直下に足した CSS も fork の物
- グラデーションは既定と実効の対: `pnpm generate styles` が上流の既定を `core/gradient.css` に、そのリポの分(`src/config/lib/gradient.config.ts`)を直下の `gradient.css` に書く。fork が自分の分を足して再生成するのは正しい使い方(手で編集しない)。`core/` の下に fork の差分は出ない。同じ key を書けば直下の分が後から読まれて上書きする
- 名前の印: `core/` = upstream の物(`src/features/core/` と同じ印)。既定と上書きは置き場で分ける: `core/<名前>.css` = 上流の既定、直下の同じ名前 `<名前>.css` = そのリポの上書き(`core/palette.css` と直下の `palette.css` など)

upstream 側のファイルの役割(upstream でスタイルを足すときの置き場所):

- `@import "tailwindcss"` は `core/index.css` の 1 か所だけ。upstream の CSS は `core/index.css` 経由で読まれるので個別に import しない(プラグインも `core/index.css` にまとめる)。upstream が CSS を足すときも `core/index.css` に import を足す(fork 所有の `global.css` は触らない)
- `animations.css`: `--animate-*` の宣言と、対応する `@keyframes` を同じファイルに書く
- `base.css`: リセットと HTML 要素の基本スタイルだけ。ページ固有のスタイルは書かない
- `components.css` / `admin.css`: 再利用する UI パターンを `@layer components` に(`admin.css` は管理画面専用)。先にコンポーネントの variant で表現できないかを検討する
- `utilities.css`: Tailwind のユーティリティで表現しづらい 1 プロパティ完結のクラス

### data-slot の付け方(upstream が部品を作るとき)

- 原則: **className を渡せない所**(枠の部位・部品の内側)にだけ付ける。className を渡せる所は className とバリアントで足りる
- 便宜上、className も data-slot も持つ要素がある。そこでは**常に data-slot(fork の CSS)が勝つ**(無レイヤーだから)。上流の画面がその要素に className で書いた値も、fork の data-slot の規則が上書きする
- 両方を持つ要素の一覧(今):
  - `main`(Layout/Main の `<main>`。`surfaceDisplay` だけは className が外側の `main-layout` に付き、`<main>` は `innerClassName` を受ける)
  - `page-title`(TextBlocks/PageTitle の h1)・`sec-title`(TextBlocks/SecTitle)
  - `admin-page-title`(管理のページの題の h1、`src/app/admin/_layout/AdminPageTitle.tsx`)・`admin-sec-title`(管理画面の SecTitle)
  - 入らない物: `user-page-title`(UserPageTitle の外側の header)は呼び手の className を受けない(className は中の h1 へ)
- この一覧に足す条件(3 つすべて): className を渡せる要素である / fork がサイト全体で揃えたい実例がある / バリアントの上書きの口では受けられない
- 印の名前 = その要素を描く部品(または部位)の名前の kebab(`popover-content`・`header-shell`)。印の一覧は各部品・枠の README(枠 = `src/app/(user)/_layout/README.md` と `src/app/admin/_layout/README.md`)。一覧とコードの一致は印の一覧の検査で確かめる。印を消す・名前を変えるときの決まりは `.claude/rules/core/style.md` building_a_part

### トークンで動く範囲

トークン(と `variants.config.ts`)を変えたときに動く所と動かない所。

| 種類 | 動く | 動かない |
|---|---|---|
| 色(`--primary` 等) | トークンを使う全クラス(`bg-primary`・`text-success-text` …)と、それを参照するグラデーション・影 | 生パレット色(lint で禁止)・任意値の色 |
| 角丸(`--radius`) | `rounded-sm/md/lg/xl` | `rounded-[12px]` などの任意値 |
| appearance の影(`--appearance-shadow-*`) | Layout 部品の `appearance`(raised / outlined / frosted / soft / radiant) | `shadow-sm` 等の Tailwind の影の段(それは `@theme` の `--shadow-*`)・className の `shadow-[...]` |
| 部品の形(`variants.config.ts`) | その部品の variant / size の全部 | 要素の `className`(上書きより後ろで勝つ) |
| 余白の段(`--space-none`〜`--space-4xl`、`core/config.css` の `:root`) | Layout 部品の余白 prop(`gap`・`gapX`・`gapY`・`padding*`・`margin*`、段の表: `src/components/Layout/README.md`「余白」) | 部品の内側の余白(size のバリアントで変える)・className の数値(`p-4` 等。固定)。`@theme` の `--spacing` は使わない |
| 操作部品の高さの段(`--control-h-xxxs`〜`--control-h-xxxl`・`--tablet-control-h-xxs`〜`xl`、`core/config.css` の `:root`。md は `@media (min-width: 40rem)` の側も) | ボタン・TabletButton の size、入力欄系と選ぶ欄の引き金の size、欄の中の小さなボタン、StepperInput(段の表: `src/components/Button/README.md`・`src/components/Input/README.md`「高さ(size)」) | 要素の className の高さ(`h-*`・`py-*`)・ボタンの `icon` 系・Textarea・スイッチやチェックボックスの size |

### サイトテーマの仕組み

| 段階 | 場所 | 役割 |
|---|---|---|
| bootstrap | `src/app/layout.tsx` の `<head>` 内 inline script | `location.pathname` からエリアを判定し、localStorage の保存値と OS 設定も合わせて `<html class="dark" data-area="...">` を body 描画前に付ける(フラッシュ防止)。root layout は request を読まないので SSR の `<html>` には付かない(script が動かなければ既定の light)。`@/lib/siteTheme/bootstrapScript.ts` が設定を埋め込んで生成 |
| クライアント | `SiteThemeSync`(`@/lib/siteTheme`、root layout に常駐) | クライアント遷移・切替操作・OS 設定変化のたびに再解決して `<html>` を更新する唯一の書き手 |
| 判定ロジック | `@/lib/siteTheme`(純関数) | 上の 2 箇所が同じ判定を共有する。bootstrap script は手書き JS だが `pnpm test src/lib/siteTheme/siteTheme.test.mjs` が同一ケース集で一致を検証 |
| 設定 | `src/config/lib/siteTheme.config.ts`(`@lib-config/siteTheme`、下流所有) | `export default { ...差分 } satisfies SiteThemeOverride`(リテラルだけ)。既定値は `@/lib/siteTheme/defaults.ts`、合成は `@/lib/defineConfig`。合成済みの値は入口の `siteThemeConfig` |

### 表示と保存の分離

lib の中の `src/lib/siteTheme/dom.ts`(入口から出さない)は DOM 適用(`applyThemeToDom`)と保存(`persistThemePreference`)を分けている。保存は利用者の切替操作(`useDarkModeSwitch` や `useSiteThemeStore` の `toggle` / `setDark`)のときだけ。固定エリアの適用や OS 追従で保存値を汚さない。

### デプロイ後の確認(Vercel ビルドキャッシュ)

Vercel が前回デプロイのビルドキャッシュを復元すると、キャッシュ作成後に `global.css` / `core/index.css` へ足された `@import` 先が、出力 CSS から黙って抜けることがある。ローカル dev とローカル `next build` は正常で、本番だけ崩れる。

- **症状**: パレット・角丸・書体が一斉に失われる(`--primary` / `--radius` / `--font-geist-sans` が未定義)。崩れた本番の CSS チャンク(`/_next/static/**/*.css`)を取得して `--primary:` を grep すると無い。ビルドログに `Restored build cache from previous deployment` がある
- **起きやすい状況**: デプロイ頻度の低い fork が、CSS ファイルを足す上流 notice(core/palette.css / core/typography.css の導入、`core/` への入れ替えなど)を何件もまとめて取り込んだ直後の初回デプロイ
- **ガード**: `pnpm build` の末尾の門 `pnpm check --gate=build:post` で `pnpm check styles` が走り、`global.css` から辿れる全ファイルの CSS 変数が `.next/static/**/*.css` に揃っていなければビルドを落とす(本番に出る前に止まる)。Vercel の Build Command が `pnpm build` 以外だと走らない
- **直し方**: キャッシュを使わずに再デプロイする。`pnpm live -- --prod --force`、またはダッシュボードの Redeploy で「Use existing Build Cache」を外す、または環境変数 `VERCEL_FORCE_NO_BUILD_CACHE=1` を一時的に置いて再デプロイし成功後に外す。キャッシュを常時無効にはしない(Hobby プランはビルド CPU が逼迫する)
- **運用ルール**: CSS ファイルを足す・構成を変える notice を取り込んだ後の初回本番デプロイは、ガードの有無にかかわらずキャッシュ無しで行う
- **目印の変数**: `@theme` の外に変数を持たない upstream のファイル(`core/` の theme / animations / base / components / admin)は、固有の目印 `--styles-marker-<名前>: 1`(枠の規則 frame.css は `--styles-marker-frame`)を宣言して検査対象にしている。`core/` に CSS を足すときも、固有の変数が無ければ目印を 1 つ置く
- **ガードの限界**: 他のファイルが宣言している名前だけを上書きするファイル(`palette.css` で `--primary` だけ変える等)は、抜けても名前が残るので検出できない(警告のみ)。fork 独自の変数(例 `--brand-accent`)を 1 つ宣言すれば検査対象になる。`@theme` 内の変数と `@utility` の中身は出力に残る保証が無いため検査しない

## Verification

| コマンド | 内容 |
|---|---|
| `pnpm check styles` | ビルド済み CSS に global.css から辿れる全ファイルの変数が揃っているか(`pnpm build` が自動で実行) |
| `pnpm test scripts/structure/styles/builtCss.test.mjs` | 上記の判定ロジック(@theme / @utility の除外、相対 import の走査、missing / unverifiable の判定) |
| `pnpm test src/lib/siteTheme/siteTheme.test.mjs` | 既定値の互換、エリア一致、ロック、bootstrap script と resolver の一致 |
| `pnpm test src/styles/core/` | theme.css の参照変数が上流 CSS で全て定義されている / `.dark` が `:root` に無い変数を持ち込まない / 意味色の 3 変数が揃っている / 書体変数が core/typography.css にある / `core/index.css` と `global.css` の import 順 / upstream が出荷する直下の palette / typography / overrides / gradient.css はコメントだけ・global.css は @import だけ(upstream のみ) |
| `pnpm test src/lib/fonts/fonts.test.mjs` | 書体の設定の合成(buildFontsConfig: 既定は読み込み無し、variable クラス連結、variable 無しは拒否)、core/typography.css の loaded 変数参照 |
| `pnpm test src/lib/cn/cn.test.mjs` | theme.css の `--text-*` と tailwind-merge 登録のドリフト |
| `pnpm test src/lib/variantOverrides/variantOverrides.test.mjs` | オーバーライド無しで cva と同一出力 / 結合順(cva → オーバーライド → className)/ 既定 variant の解決 / 出荷時の variants.config.ts が空 |
| `pnpm test eslint-rules/style-tokens.test.mjs` | 生パレット色検出規則の検出・非検出ケース |

直下の fork のファイルは中身を検証しない(fork が自由に書く場所。入口の形と出荷時の中身だけを upstream で見る)。
