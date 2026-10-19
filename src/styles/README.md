# src/styles — スタイル基盤と所有権

このディレクトリは「upstream が構造を持ち、下流(fork)が値を持つ」構成になっている。
下流がデザインを変えるために upstream 所有のファイルを編集する必要はなく、編集しなければ merge 衝突も起きない。

## 下流が覚えることは 3 つ

| 変えたいもの | 書く場所 | それ以外 |
|---|---|---|
| 見た目の値(色・書体・影・余白) | `src/styles/custom/` | 触らない |
| 振る舞いと形の設定(テーマ既定・エリアロック・Web フォント読み込み・ボタン/バッジの形) | `src/config/ui/site-theme.config.ts` / `fonts.config.ts` / `variants.config.ts` | 触らない |
| 画面そのもの | `src/app/**/page.tsx` の 1 行スイッチ | core の画面部品は触らない |

書かなければ upstream の既定値で動く。upstream がトークンや設定キーを足しても、下流は何も追記しなくてよい。

## ファイルと所有権

```
src/styles/
├── global.css              upstream  import の順序だけ。最後に ./custom/index.css
├── theme.css               upstream  @theme inline のトークン構造、@custom-variant、color-scheme。値は書かない
├── palette.defaults.css    upstream  :root / .dark の色の既定値(値だけ)
├── typography.defaults.css upstream  書体スタックの既定値(--font-geist-sans/mono、loaded 変数へフォールバック参照)
├── config.css              upstream  レイアウト系トークン(幅・管理画面余白)
├── z-layer.css             upstream  z-index トークン
├── gradient.css            upstream  gradient:gen で生成(src/lib/gradient)
├── animations.css / base.css / components.css / utilities.css / admin.css   upstream
└── custom/                 下流      ★ upstream は初回作成後に一切編集しない
    ├── index.css           下流      入口。出荷時は下の 3 ファイルを import するだけ
    ├── palette.css         下流      変えたい色だけ書く(出荷時は空)
    ├── typography.css      下流      変えたい書体・サイズだけ書く(出荷時は空)
    └── overrides.css       下流      ユーティリティが触らない領域だけ(出荷時は空)
```

同じ考え方の前例: `src/features/core/setting/entities/*.extended.ts`(upstream の基底に下流が拡張を足し、upstream は extended 側を触らない)。

upstream 側のファイルの役割(upstream でスタイルを足すときの置き場所):

- `@import "tailwindcss"` は `global.css` の 1 か所だけ。他の CSS は `global.css` 経由で読まれるので個別に import しない(プラグインも `global.css` にまとめる)
- `animations.css`: `--animate-*` の宣言と、対応する `@keyframes` を同じファイルに書く
- `base.css`: リセットと HTML 要素の基本スタイルだけ。ページ固有のスタイルは書かない
- `components.css` / `admin.css`: 再利用する UI パターンを `@layer components` に(`admin.css` は管理画面専用)。先にコンポーネントの variant で表現できないかを検討する
- `utilities.css`: Tailwind のユーティリティで表現しづらい 1 プロパティ完結のクラス

### 色の正は CSS

色の唯一の正は `palette.defaults.css`(既定)と `custom/palette.css`(上書き)。派生物はそこから生成する:

- メール用 hex 定数: `pnpm mail:generate-colors`(両ファイルの `:root` を合成して `src/features/core/mail/constants/colors.ts` を生成。欠落があれば失敗する)。色を変えたら必ず実行してコミットする。メールはダークモードもエリアも持たないので `.dark` と `[data-area]` は読まない。ブランド色を `[data-area="user"]` にだけ書くとメールは汎用色のままになる。メールにも反映したい色は `:root` にも書くこと
- gradient トークン: `pnpm gradient:gen`(`src/config/app/gradients.config.ts` → `gradient.css`。palette には依存しない)

shadcn / tweakcn 等のジェネレータが出力する `:root { ... } .dark { ... }` は、そのまま `custom/palette.css` に貼れば効く。

## custom/ の書き方

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

- 変数名と既定値の一覧は `palette.defaults.css`
- `data-area` は `<html>` に付く(root layout が SSR 付与)。値は `site-theme.config.ts` のエリア key(既定: `user` / `admin`)
- Dialog / Toast / Popover は body 直下にポータル描画されるが、`<html>` 属性なので自動で継承される

#### 意味色は 3 変数で 1 組(塗り / 塗りの上の文字 / 素の背景の文字)

`success` / `info` / `warning` / `destructive` の 4 色は、用途の違う 3 変数を持つ。core の部品はこの区別で書かれているので、下流は役割ごとに値を決めるだけでよい。

| 変数 | 用途 | Tailwind | 例 |
|---|---|---|---|
| `--success` | 塗り(背景・枠線・アイコンの台・スイッチ) | `bg-success` / `border-success` / `ring-success` | ボタン・ソリッドバッジの背景 |
| `--success-foreground` | 塗りの上に載せる文字・アイコン | `text-success-foreground` | ボタンのラベル |
| `--success-text` | 素の背景(ページ・カード)に置く文字・アイコン | `text-success-text` | 完了メッセージ、ソフトバッジの文字、`<Para tone="success">` |

塗りを淡いパステルにしたいなら `--success` だけ変える。`--success-text` を変えなければ本文は読めるまま。塗り用トークンを文字色に使う(`text-success`)のは禁止(下流が塗りを淡くすると読めなくなる)。既定値はライトが従来の `<Para tone>` の文字色(amber-600 / red-600 / emerald-600 / sky-600 相当)、ダークがその 400 系(ダーク背景で読める明るさ)。`.dark { --success-text: ... }` で上書きできる。

影の `shadow-[... rgba(...)]` リテラルは lint の対象外で、ブランド色に追従しない。追従させたい場合は `appearance.radiant` と同じ `color-mix(in oklch, var(--color-primary) 20%, transparent)` の形で書く。

`--overlay` は画面を覆う幕(モーダル背景・SP ナビの背景)。`bg-overlay/50` のように透過率付きで使う(既定は黒)。

### 書体(fonts.config.ts と typography.css)

書体は 2 段構え。既定では Web フォントを読み込まず system スタックで表示する(従来どおり)。

| やりたいこと | 書く場所 |
|---|---|
| Web フォントを読み込む(Google Fonts / ローカルファイル) | `src/config/ui/fonts.config.ts`(next/font) |
| Web フォントは使わず system フォントの並びを変える | `custom/typography.css` の `--font-geist-sans` |
| 文字サイズ(流体サイズ等)を変える | `custom/typography.css` の `@theme` |

仕組み: next/font のローダーを `variable: "--font-sans-loaded"`(mono は `"--font-mono-loaded"`)で呼び `defineFontsConfig({ sans })` に渡すと、root layout が `<html>` にクラスを当ててその変数を定義する。`typography.defaults.css` のスタックは `--font-geist-sans: var(--font-sans-loaded, "Inter", system-ui, ...)` と書かれているので、読み込まれていればそれを、無ければ system スタックを使う。theme.css と Tailwind の `font-sans` / `font-mono` は一切変えない。

```ts
// src/config/ui/fonts.config.ts
import { Noto_Sans_JP } from "next/font/google";
import { defineFontsConfig } from "@/lib/fonts";
const sans = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-sans-loaded", display: "swap" });
export const FONTS_CONFIG = defineFontsConfig({ sans });
```

next/font の制約: ローダーはモジュールのトップレベルで、引数はリテラル(変数や import 定数は不可)。`variable` 名は上の固定文字列をそのまま書く。別名を書いても型や実行時では検知できず黙って効かなくなるため、`pnpm test:fonts` が `fonts.config.ts` のソースを静的に検査する。Google Fonts はビルド時に取得されセルフホスト化される(実行時に Google への通信は発生しない)。next/font は Next のコンパイラ外(scripts/ や node --test)では動かないので、ローダーを追加した後は `fonts.config.ts` を Next 外から import しない。

```css
/* custom/typography.css */
:root {
  --font-geist-sans: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;  /* system フォントの並びだけ変える */
}
@theme {
  --text-fluid-5xl: clamp(2.5rem, 6vmin, 4rem);   /* theme.css の流体サイズを同名で上書き */
}
```

注意: `custom/typography.css` で `--font-geist-sans` を上書きすると、その値が `fonts.config.ts` で読み込んだ Web フォントより優先される(loaded 変数への参照を自分で消すことになる)。両方使う場合は `var(--font-sans-loaded, ...)` を含めて書く。

メールテンプレートの書体は別系統(各テンプレートの inline `fontFamily`、メールクライアント向けの system スタック)で、この設定の影響を受けない。

### 影・角丸・イージング

Tailwind v4 の名前空間をそのまま上書きする。独自トークンは作らない。

```css
/* 角丸: --radius は palette.defaults.css が無レイヤーの :root で定義しているので、同じ :root で上書きする
   (@theme { --radius } は @layer theme に入り、無レイヤーの :root に負けて効かない) */
:root {
  --radius: 1rem;            /* theme.css の --radius-sm/md/lg/xl が連動する */
}
/* 影・イージングは Tailwind の名前空間トークン(上流に無レイヤー定義が無い)なので @theme で効く */
@theme {
  --shadow-xs: none;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.1);
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
}
```

判断基準: `palette.defaults.css` / `config.css` / `z-layer.css` に `:root { --x }` として定義済みの変数は `:root` で、それ以外の Tailwind 名前空間(`--shadow-*` / `--ease-*` / `--text-*` / `--animate-*` 等)は `@theme` で上書きする。

### overrides.css の限界(重要)

`custom/` は Tailwind の `@layer` の外(無レイヤー)で読み込まれる。無レイヤー CSS は utilities 層より常に強いので、同じプロパティを書くとコンポーネントの個別 `className` が効かなくなる。

- 書いてよいもの: 要素の既定(`body`、`a`、`::selection`、scrollbar)、`@keyframes`、`[data-area="admin"] body { ... }` のようなエリア単位の全体調整
- 書いてはいけないもの: `[data-slot="button"] { border-radius: ... }` のような cva 基底クラスの上書き。ボタンの角丸や影などの variant は `src/config/ui/variants.config.ts`(次節)で TS 側の文字列を差し替える

### variant オーバーライド(variants.config.ts)

Button / Badge の形(角丸・影・枠線・寸法)は、core を編集せずに `src/config/ui/variants.config.ts` で差し替える。書いたクラスが cva の出力の後ろに結合され、同じプロパティは tailwind-merge で後勝ちする。各要素の `className` はさらにその後ろなので、個別指定は従来どおり勝つ。

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
- 色はここではなく `custom/palette.css` のトークンで変える(トークンなら全部品に効く)。ここは形の差し替え用
- キーと variant / size 名は upstream が維持する契約。削除・改名時は `.notices` で通知する。upstream がキーを増やしても下流の設定は追記不要
- 仕組み: `@/lib/variantOverrides` の `createOverridableVariants(base, cvaConfig, override)`(cva と同じ引数・同じ返り値型)。新しい primitive にも同じ 1 関数で配線する

### 生パレット色の禁止(ESLint)

upstream 所有の UI(`src/components` / `src/lib` / `src/features/core` / `src/features/_template`)では `bg-slate-900` / `text-red-600` / `bg-white` / `text-[#fff]` のような生パレット色クラスを ESLint(`style-tokens/no-raw-palette`)が error にする(下流固有の UI は対象外。同じ規律を敷きたい fork は `eslint.config.mjs` の `files` にパスを足す)。あわせて `src/components` 外からの `_shadcn` 直接 import も error(`no-restricted-imports`、対応表は `src/components/_shadcn/README.md`)。生パレット色はブランド色に追従せず `dark:` 併記が要り、下流が core を直す動機になるため。白黒は `bg-background` / `text-foreground` / `bg-card`、幕は `bg-overlay/50`、意味色は上の 3 変数で書く。ブランドロゴ色など正当な例外は理由付き `// eslint-disable-next-line style-tokens/no-raw-palette -- 理由` で明示する。

### config.css の値を変えたいとき

`config.css` の管理画面余白トークン等は `custom/` のどのファイルからでも `:root { --admin-page-padding-inline: 2rem; }` で上書きできる。`config.css` 側が `@media (min-width: 40rem)` で値を切り替えているトークンは、同じメディアクエリも書くこと(無レイヤーの `:root` は全幅で勝つため)。

### Tier2 → Tier3 の重ね合わせ

`custom/index.css` の `@import` 順がそのまま優先順位。Tier2 が `brand.css` を足して import し、Tier3 がさらに自分のファイルを後ろに足せば、Tier3 が勝つ。

## サイトテーマ(ライト / ダーク)

### 仕組み

| 段階 | 場所 | 役割 |
|---|---|---|
| SSR | `src/app/layout.tsx` | `x-pathname`(proxy.ts 付与)からエリアを判定し `<html class="dark" data-area="...">` を出力。初回描画がエリアの既定で確定する |
| bootstrap | 同 layout の `<head>` 内 inline script | localStorage の保存値と OS 設定を body 描画前に反映(フラッシュ防止)。`@/lib/siteTheme/bootstrapScript.ts` が設定を埋め込んで生成 |
| クライアント | `SiteThemeSync`(`src/components/Fanctional`、root layout に常駐) | クライアント遷移・切替操作・OS 設定変化のたびに再解決して `<html>` を更新する唯一の書き手 |
| 判定ロジック | `@/lib/siteTheme`(純関数) | 上の 3 箇所が同じ判定を共有する。bootstrap script は手書き JS だが `pnpm test:site-theme` が同一ケース集で一致を検証 |
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

## テスト

| コマンド | 内容 |
|---|---|
| `pnpm test:site-theme` | 既定値の互換、エリア一致、ロック、bootstrap script と resolver の一致 |
| `pnpm test:style-tokens` | theme.css の参照変数が上流 CSS で全て定義されている / `.dark` が `:root` に無い変数を持ち込まない / 意味色の 3 変数が揃っている / 書体変数が typography.defaults.css にある / global.css の import 順 |
| `pnpm test:fonts` | defineFontsConfig の既定(読み込み無し)と variable クラス連結、typography.defaults.css の loaded 変数参照 |
| `pnpm test:cn` | theme.css の `--text-*` と tailwind-merge 登録のドリフト |
| `pnpm test:variant-overrides` | オーバーライド無しで cva と同一出力 / 結合順(cva → オーバーライド → className)/ 既定 variant の解決 / 出荷時の variants.config.ts が空 |
| `pnpm test:style-lint` | 生パレット色検出規則の検出・非検出ケース |

`custom/` は検証対象外(下流が自由に書く場所)。
