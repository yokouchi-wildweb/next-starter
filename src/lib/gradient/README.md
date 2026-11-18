# gradient

## Overview

- グラデーションのデザイントークンを TS と CSS の単一ソースで管理し、TS から列挙・適用できるようにするライブラリ。あわせて default / solid / gradient の 3 モードを持つカラー値モデルと、グラデーション文字列の解析ヘルパーを持つ。入口 `@/lib/gradient`(純粋 TS・React 非依存)
- 用途の二段構成:
  - 実行時(ピッカー / inline style / canvas)→ `listGradients()` の `cssValue` を直接使う(CSS クラス不要・SSR 安全、`getComputedStyle` 非依存)
  - ビルド時(`bg-gradient-*` などの Tailwind `@utility`)→ `pnpm generate styles` で生成。Tailwind はビルド時にしかクラスを生成できないため
- 使う時・直す時の決まりは札 .claude/rules/items/lib/gradient.md にある

## Usage

### トークンを足す

- upstream 標準: `src/lib/gradient/tokens.base.ts`(`BASE_GRADIENTS`)
- そのリポの分: `src/config/app/gradients.config.ts`(`customGradients`、既定 空)
- 値を変えたら `pnpm generate styles` で再生成し、生成物をコミットする
- 同一キーは後勝ち(custom が base を上書きできる)

```ts
// 例: downstream の config/app/gradients.config.ts
export const customGradients: GradientTokenInput[] = [
  { key: "tier-s", label: "Sランク", group: "ランク",
    stops: ["oklch(0.85 0.18 95)", "oklch(0.7 0.2 40)"], text: true },
];
```

### 色を描く

```tsx
<ColorValueInput
  field={field}
  defaultPreview="var(--color-primary)"
  defaultLabel="テーマ既定"
/>
// 描画側:
const css = resolveColorValue(value, { resolveDefault: () => "var(--color-primary)" });
<div style={{ background: css }} />
```

## API

### トークンレジストリ

- `listGradients(): GradientToken[]` — 確定形(`cssValue` 付き)で全件列挙。ピッカーの選択肢など
- `getGradient(key): GradientToken | null` — キー取得
- `registerGradients(tokens: GradientTokenInput[]): void` — 実行時の動的追加(特殊用途)
- `listGradientInputs(): GradientTokenInput[]` — 登録形(`darkStops` / `text` 含む)。codegen 用
- `GradientToken = { key, label, stops, group?, cssValue }`

### カラー値モデル

- `ColorValue = { mode:"default" } | { mode:"solid"; solid } | { mode:"gradient"; gradientKey }`
- `resolveColorValue(value, ctx?): string` — 最終 CSS へ解決。`"default"` の意味は `ctx.resolveDefault` で消費側が注入。生 CSS 文字列もそのまま受理(後方互換)
- `normalizeColorValue(input): ColorValue` — 生 CSS 文字列 / 旧データ → ColorValue へ正規化(既知グラデは `gradientKey` に逆引き)
- `isColorValue(v): v is ColorValue`

### グラデーション解析ヘルパー

- `isGradient(css): boolean`
- `extractEdgeColors(css): { left, right } | null` — 両端の色を抽出。oklch / hsl / hex / rgb 対応(括弧内カンマ・位置指定を正しく処理)

### CSS 生成ヘルパー

- `buildGradientCss(stops, angle?): string` — `linear-gradient(...)` 文字列
- `DEFAULT_GRADIENT_ANGLE`(=135)

## Extension

### カラー値ピッカー(colorValueInput)

- `colorInput` を拡張した `colorValueInput`(3 モード)。ドメイン非依存に保つため `"default"` の意味(プレビュー / ラベル)は props で注入する
- Manual: `@/components/Form/Input/Manual` → `ColorValueInput`
- Controlled: `@/components/Form/Input/Controlled` → `ColorValueInput`(RHF `field` を渡す。値は `ColorValue`。生 CSS 文字列も受理し内部で `normalizeColorValue`)
- props: `modes?`, `defaultPreview?`, `defaultLabel?`, `gradients?`, `layout?`, `gradientPickerVariant?`
- `layout`: `"stack"`(既定・縦積みブロック)/ `"inline"`(1 行セグメンテッド + インライン chip + gradient ドロップダウン。密なテーブル行向け)
- `gradientPickerVariant`: `"grid"` / `"dropdown"`(既定は layout から導出。stack→grid, inline→dropdown)
- `value`: `ColorValue | string | null`。生 CSS 文字列(旧データ)を渡しても内部正規化されモードが確定する
- `FormInputType: "colorValueInput"` として `inputResolver` にも登録済み(domain.json 経由では default の意味注入ができないため既定挙動。意味を注入したい場合は Controlled / Manual を直接使う)

## Internals

- TS(`tokens.base.ts` + `config/app/gradients.config.ts`)を単一ソースにし、そこから `gradient.css` を codegen で生成する(生成物コミット方式)。生成器は `scripts/structure/styles/generate-gradient-css.ts`(`pnpm generate styles`)
- 出力先: 上流の既定(`tokens.base.ts`)→ `src/styles/core/gradient.css`、そのリポの分(`gradients.config.ts`)→ 直下の `src/styles/gradient.css`(global.css が読む)。fork の分は `core/` の下に出ない
