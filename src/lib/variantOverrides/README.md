# variantOverrides

## Overview

- 棚の部品(Button / TabletButton / Badge / 入力部品 / TextBlocks)の形(角丸・影・枠線・寸法・文字)を、core を編集せずに下流が差し替える仕組み。入口 `@/lib/variantOverrides`、合成済みの値は `@/lib/variantOverrides/config`
- 軸の値の名前(variant / size / tone …)の型はこの lib が持つ。部品の既定のクラスの表はその型に `satisfies Record<名前, string>` で揃え、部品は名前の型をここから読んで自分の props の型として見せる(再 export)。名前の定義は一つだけで、部品の側に二つ目を作らない
- **この lib は棚(`src/components`)を読まない(型も)**。棚がこの lib を読む向きだけ
- 使う時・直す時の決まりは札 .claude/rules/items/lib/variantOverrides.md にある

## Usage

```ts
// src/config/lib/variantOverrides.config.ts
import type { VariantOverridesOverride } from "@/lib/variantOverrides/config";

export default {
  button: { base: "rounded-full shadow-none", variant: { outline: "border-2" }, size: { md: "h-11 px-5" } },
  badge: { size: { md: "px-2 py-0.5" }, solid: { base: "rounded-md" } },
} satisfies VariantOverridesOverride;
```

- 書いたクラスは部品の既定のクラスの後ろに結合され、同じプロパティは tailwind-merge で後勝ちする。要素の `className` はさらにその後ろ
- キーごとの対象と例: src/styles/Extension.md「バリアントの上書き(variants.config.ts)」

## API

- `createOverridableVariants(base, cvaConfig, override)` — cva と同じ引数・同じ返り値の型で variant 関数を作り、出力の後ろに上書きを結合する(`VariantProps<typeof x>` もそのまま使える)
- `variantOverrideClasses(override, { 軸: 値 })` — 状態で効き方が変わる軸(スイッチの色・カードの色・バッジ)で、該当するクラスを順に返す。`cn()` に展開する
- `defineVariantOverrides(input)` — 下流の差分を完全形に直す(未指定のキーは空)
- 型
  - 上書きの形: `VariantOverride<V, S>`(base / variant / size)、`AxisOverride<Axes>`(base + 任意の軸)、`VariantOverridesInput`(下流が書く差分)、`VariantOverrides`(完全形)、キーごとの `*Override`
  - 軸の値の名前: `ButtonVariantName`・`ButtonSizeName`・`TabletButtonVariantName`・`TabletButtonSizeName`・`BadgeVariant`・`BadgeSize`・`InputSize`・`CheckControlSize`・`SingleCardCheckboxColor`・`StepperInputSize`・`SwitchInputColor`・`TextTone`・`TextSize`・`TextWeight`・`TextAlign`
- `variantOverrides`(`@/lib/variantOverrides/config`)— 既定と上書きを合成した値。部品はこれを読む

## Extension

- 上書きのファイル: `src/config/lib/variantOverrides.config.ts`(`@lib-config/variantOverrides`、型 `VariantOverridesOverride`)。既定は空 = 上流の見た目のまま
- キーと軸の値の名前は上流が保つ公開契約。消す・改名するときは notice を出す。上流がキーを足しても下流の設定は書き足し不要

## Internals

- 結合の順: 部品の既定のクラス(cva 出力)→ `base` → 軸ごと(cva の variants の順、`variantOverrideClasses` は渡した軸の順)→ `class` → `className`
- 合成: `config.ts` が `@/lib/defineConfig` で既定(空)と上書きを合わせ、`defineVariantOverrides` で未指定のキーを空で埋める(部品は `?.` 無しで読める)
- 名前を足すとき: まず `types.ts` の名前の型に足し、部品の表に同じ名前のクラスを足す(`satisfies` が片方だけの名前を型の誤りにする)

## Verification

- `pnpm test src/lib/variantOverrides`(正規化・結合の順)
