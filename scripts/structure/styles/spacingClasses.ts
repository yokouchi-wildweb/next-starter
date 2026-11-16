// scripts/structure/styles/spacingClasses.ts
//
// 余白の段の class の表(src/components/Layout/spacingClasses.generated.ts)の中身を作る純粋ロジック。
// 書き出しは generate-spacing-classes.ts(pnpm generate styles)、表 ⇔ 名前の一覧の照合は spacingClasses.test.mjs、
// 表の class がビルドした CSS に届いているかの検査は builtCss.ts の checkSpacingClasses(pnpm check styles)。
//
// 表を生成するわけ: Tailwind は字面に現れる class しか CSS にしない。gap-${n} のような組み立ては
// ほかで字面に書かれた値しか届かない(88-base の space={24} が 0 になった件)。全部の組を字面で持てば必ず届く。

import {
  SPACING_BREAKPOINTS,
  SPACING_NAMES,
  SPACING_PROP_UTILITIES,
  spacingClass,
  type SpacingProp,
} from "@/components/Layout/spacingScale";

export const SPACING_CLASSES_OUTPUT = "src/components/Layout/spacingClasses.generated.ts";

/** prop → 幅 → 名前 → class の字面 */
export function buildSpacingClasses(): Record<string, Record<string, Record<string, string>>> {
  const table: Record<string, Record<string, Record<string, string>>> = {};
  for (const prop of Object.keys(SPACING_PROP_UTILITIES) as SpacingProp[]) {
    table[prop] = {};
    for (const breakpoint of SPACING_BREAKPOINTS) {
      table[prop][breakpoint] = {};
      for (const name of SPACING_NAMES) table[prop][breakpoint][name] = spacingClass(prop, breakpoint, name);
    }
  }
  return table;
}

/** 表の全 class(重複なし、表の順) */
export function listSpacingClasses(table = buildSpacingClasses()): string[] {
  return Object.values(table).flatMap((byBreakpoint) => Object.values(byBreakpoint).flatMap((byName) => Object.values(byName)));
}

const key = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));

/** 生成ファイルの中身 */
export function renderSpacingClasses(table = buildSpacingClasses()): string {
  const lines = [
    "// src/components/Layout/spacingClasses.generated.ts",
    "// 生成物(pnpm generate styles、scripts/structure/styles/generate-spacing-classes.ts)。手で直さない。",
    "// 源 = src/components/Layout/spacingScale.ts(段の名前・幅・余白 prop)。",
    "// Layout 部品の余白 prop → 幅 → 段の名前 → class の字面。Tailwind が拾えるよう全部の組を字面で持つ",
    "// (class の組み立て禁止)。表の class がビルドした CSS に届いているかは pnpm check styles が確かめる。",
    "",
    "export const SPACING_CLASSES = {",
  ];
  for (const [prop, byBreakpoint] of Object.entries(table)) {
    lines.push(`  ${key(prop)}: {`);
    for (const [breakpoint, byName] of Object.entries(byBreakpoint)) {
      const cells = Object.entries(byName).map(([name, cls]) => `${key(name)}: ${JSON.stringify(cls)}`);
      lines.push(`    ${key(breakpoint)}: { ${cells.join(", ")} },`);
    }
    lines.push("  },");
  }
  lines.push("} as const;", "");
  return lines.join("\n");
}
