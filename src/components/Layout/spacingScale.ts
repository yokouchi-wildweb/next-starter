// src/components/Layout/spacingScale.ts
//
// 余白の段(Layout 部品の余白 prop が受ける名前)の一覧。名前 → px の正はここ 1 か所。
// - CSS のトークン --space-<名前> は src/styles/core/config.css の :root(値の正は CSS、fork は直下の CSS で上書きできる)。
//   ここの px はトークンの上流の既定値と一致する(src/styles/core/styleTokens.test.mjs が確かめる)
// - 部品が使う class の字面の表 spacingClasses.generated.ts は、この一覧から pnpm generate styles が作る
// - 全部品・全余白 prop で同じ名前 = 同じトークン(部品ごとに大きさを変えない)

/** 段の名前 → 上流の既定の px(小さい順) */
export const SPACING_SCALE = {
  none: 0,
  "2xs": 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 48,
  "4xl": 64,
} as const;

export type SpacingName = keyof typeof SPACING_SCALE;

/** 段の名前(小さい順) */
export const SPACING_NAMES = Object.keys(SPACING_SCALE) as SpacingName[];

/** 幅別の指定で使える幅(base = 幅の指定なし。Tailwind の画面幅の接頭辞と同じ名前) */
export const SPACING_BREAKPOINTS = ["base", "sm", "md", "lg", "xl", "2xl"] as const;

export type SpacingBreakpoint = (typeof SPACING_BREAKPOINTS)[number];

/** 余白 prop → Tailwind の class の頭(値は gap-(--space-md) のように CSS 変数で渡す) */
export const SPACING_PROP_UTILITIES = {
  gap: "gap",
  gapX: "gap-x",
  gapY: "gap-y",
  padding: "p",
  paddingBlock: "py",
  paddingInline: "px",
  margin: "m",
  marginBlock: "my",
  marginInline: "mx",
} as const;

export type SpacingProp = keyof typeof SPACING_PROP_UTILITIES;

/** トークンの名前(--space-<名前>) */
export const spacingToken = (name: SpacingName) => `--space-${name}` as const;

/** prop・幅・名前 → class の字面(表を作る生成器と表のテストが使う。部品は生成した表を読む) */
export function spacingClass(prop: SpacingProp, breakpoint: SpacingBreakpoint, name: SpacingName): string {
  const body = `${SPACING_PROP_UTILITIES[prop]}-(${spacingToken(name)})`;
  return breakpoint === "base" ? body : `${breakpoint}:${body}`;
}
