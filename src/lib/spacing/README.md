# spacing

## Overview

- 余白の段(`none`…`4xl`)と、余白 prop の値 → Tailwind の class の引き当て。入口 `@/lib/spacing`。依存なし(`package.json` の `libs` は空)
- 使う所: Layout 部品(Block / Stack / Flex / Grid / Section / Main …)の余白 prop、余白の値を中継する部品(AppForm の `fieldSpace` など)の型、表を作る生成器と CSS の検査
- 同じ名前 = どの部品・どの余白 prop でも同じトークン `--space-<名前>`(部品ごとに大きさを変えない)
- 使う時・直す時の決まりは札 .claude/rules/items/lib/spacing.md にある

## Usage

```tsx
import { boxSpacingClassName, spacingClassName, type SpacingValue } from "@/lib/spacing";

spacingClassName("gap", "md"); // "gap-(--space-md)"
spacingClassName("padding", { base: "sm", sm: "md" }); // "p-(--space-sm) sm:p-(--space-md)"
boxSpacingClassName({ padding: "md", marginBlock: "lg" });
```

- 余白の値を受けて Layout 部品へ渡すだけの部品は、その prop を `SpacingValue` で型付けする

## API

- `SPACING_SCALE` — 段の名前 → 上流の既定の px(小さい順)。名前 → px の正はここ 1 か所(`spacingScale.ts`)
- `SPACING_NAMES` / `SpacingName` — 段の名前の一覧と型
- `SPACING_BREAKPOINTS` / `SpacingBreakpoint` — 幅別の指定で使える幅(`base` = 幅の指定なし。Tailwind の画面幅の接頭辞と同じ名前)
- `SPACING_PROP_UTILITIES` / `SpacingProp` — 余白 prop(gap / gapX / gapY / padding / paddingBlock / paddingInline / margin / marginBlock / marginInline)→ Tailwind の class の頭
- `SpacingValue` — 余白 prop の値: 段の名前、または `{ base, sm, md, lg, xl, "2xl" }` の幅別の段の名前(どれも省略可)
- `BoxSpacingProps` — 箱の外と内の余白 prop(padding / margin 系の 6 つ。全 Layout 部品が受ける)
- `spacingClassName(prop, value)` — 1 つの余白 prop の値 → class。未指定は空文字、幅別は base → 2xl の順
- `boxSpacingClassName(props)` — 箱の余白 prop 全部 → class
- `SPACING_CLASSES` — prop → 幅 → 段の名前 → class の字面の表(生成物)
- `spacingToken(name)` / `spacingClass(prop, breakpoint, name)` — トークン名と class の字面の組み立て。表を作る生成器と表のテストだけが使う(部品は表を引く)

## Internals

- class は組み立てずに表 `spacingClasses.generated.ts` から引く(Tailwind は字面に現れた class しか CSS にしない)
- 表は `pnpm generate styles`(scripts/structure/styles/generate-spacing-classes.ts)が `spacingScale.ts` から作る。手で直さない。表の class がビルドした CSS に届いているかは `pnpm check styles` が確かめる
- CSS のトークン `--space-<名前>` は src/styles/core/config.css の `:root`(値の正は CSS、fork は直下の CSS で上書きできる)。ここの px はその上流の既定値と一致する(src/styles/core/styleTokens.test.mjs)

## Verification

- `pnpm test src/lib/spacing`(引き当て)・`pnpm test src/components/Layout/layoutSpacing.test.tsx`(部品が同じ名前で同じ class を出すか)・`pnpm test scripts/structure/styles/spacingClasses.test.mjs`(表と段の一覧の照合)
