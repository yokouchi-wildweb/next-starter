# gradient

グラデーションのデザイントークンを **TS と CSS の単一ソース**で管理し、TS から列挙・適用できるようにするライブラリ。あわせて default/solid/gradient の3モードを持つ **カラー値モデル**と、グラデーション文字列の解析ヘルパーを提供する。

## 背景・設計方針

- 従来トークンは `src/styles/gradient.css` の CSS 変数 / `@utility` のみで、**JS/TS から列挙・inline適用・プリセット選択ができなかった**。
- 解決: **TS（`tokens.base.ts`＋`config/app/gradients.config.ts`）を単一ソース**にし、そこから `gradient.css` を **codegen で生成**する（生成物コミット方式）。
- 用途の二段構成:
  - **実行時**（ピッカー / inline style / canvas）→ `listGradients()` の `cssValue` を直接使う（CSSクラス不要・SSR安全、`getComputedStyle` 非依存）。
  - **ビルド時**（`bg-gradient-*` などの Tailwind `@utility`）→ `pnpm gradient:gen` で生成。Tailwind はビルド時にしかクラスを生成できないため。
- downstream 拡張は `src/config/app/gradients.config.ts` に追記する。**upstream の `gradient.css` / `tokens.base.ts` を直接編集しない**（マージ衝突回避・所有権の明確化）。

## トークンの単一ソースと生成

- upstream 標準: `src/lib/gradient/tokens.base.ts`（`BASE_GRADIENTS`）
- downstream 固有: `src/config/app/gradients.config.ts`（`customGradients`、既定 空）
- 値を変えたら **`pnpm gradient:gen`** で `src/styles/gradient.css` を再生成し、生成物をコミットする。
- 同一キーは後勝ち（custom が base を上書き可能）。

```ts
// 例: downstream の config/app/gradients.config.ts
export const customGradients: GradientTokenInput[] = [
  { key: "tier-s", label: "Sランク", group: "ランク",
    stops: ["oklch(0.85 0.18 95)", "oklch(0.7 0.2 40)"], text: true },
];
```

## API

### トークンレジストリ
- `listGradients(): GradientToken[]` — 確定形（`cssValue` 付き）で全件列挙。ピッカーの選択肢など。
- `getGradient(key): GradientToken | null` — キー取得。
- `registerGradients(tokens: GradientTokenInput[]): void` — 実行時の動的追加（特殊用途。静的拡張は config を推奨）。
- `listGradientInputs(): GradientTokenInput[]` — 登録形（`darkStops`/`text` 含む）。codegen 用。
- `GradientToken = { key, label, stops, group?, cssValue }`

### カラー値モデル
- `ColorValue = { mode:"default" } | { mode:"solid"; solid } | { mode:"gradient"; gradientKey }`
- `resolveColorValue(value, ctx?): string` — 最終CSSへ解決。`"default"` の意味は `ctx.resolveDefault` で消費側が注入。**生CSS文字列もそのまま受理（後方互換）**。
- `normalizeColorValue(input): ColorValue` — 生CSS文字列 / 旧データ → ColorValue へ正規化（既知グラデは `gradientKey` に逆引き）。
- `isColorValue(v): v is ColorValue`

### グラデーション解析ヘルパー
- `isGradient(css): boolean`
- `extractEdgeColors(css): { left, right } | null` — 両端の色を抽出。**oklch / hsl / hex / rgb 対応**（括弧内カンマ・位置指定を正しく処理）。

### CSS 生成ヘルパー
- `buildGradientCss(stops, angle?): string` — `linear-gradient(...)` 文字列。
- `DEFAULT_GRADIENT_ANGLE`（=135）

## UI: カラー値ピッカー

`colorInput` を拡張した **`colorValueInput`**（3モード）。ドメイン非依存に保つため `"default"` の意味（プレビュー/ラベル）は props で注入する。

- Manual: `@/components/Form/Input/Manual` → `ColorValueInput`
- Controlled: `@/components/Form/Input/Controlled` → `ColorValueInput`（RHF `field` を渡す。値は `ColorValue`。生CSS文字列も受理し内部で `normalizeColorValue`）
- props: `modes?`, `defaultPreview?`, `defaultLabel?`, `gradients?`, `layout?`, `gradientPickerVariant?`
- `layout`: `"stack"`（既定・縦積みブロック）/ `"inline"`（1行セグメンテッド＋インラインchip＋gradientドロップダウン。密なテーブル行向け）
- `gradientPickerVariant`: `"grid"` / `"dropdown"`（既定は layout から導出。stack→grid, inline→dropdown）
- `value`: `ColorValue | string | null`。生CSS文字列（旧データ）を渡しても内部正規化されモードが確定する
- `FormInputType: "colorValueInput"` として `inputResolver` にも登録済み（domain.json 経由では default の意味注入ができないため既定挙動。意味を注入したい場合は Controlled/Manual を直接利用）。

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

## 配置

- `src/lib/gradient/` … トークン / レジストリ / カラー値モデル / 解析ヘルパー（純粋TS・React非依存）
- `src/config/app/gradients.config.ts` … downstream 拡張ポイント
- `scripts/styles/generate-gradient-css.ts` … `gradient.css` 生成（`pnpm gradient:gen`）
- `src/components/Form/Input/{Manual,Controlled}/ColorValueInput.tsx` … ピッカーUI
