// scripts/styles/generate-gradient-css.ts
// グラデーショントークン（src/lib/gradient）から src/styles/gradient.css を生成する。
//
// 使い方:
//   pnpm gradient:gen
//
// 方針（生成物コミット方式）:
//   - 単一ソースは TS（tokens.base.ts ＋ config/app/gradients.config.ts）。
//   - 本スクリプトで gradient.css を生成し、生成物を git にコミットする。
//   - これにより Vercel など本番ビルドは生成済みCSSをそのまま使い、ビルド手順は不変。
//   - 実行時用途（ピッカー / inline style / canvas）は listGradients() を直接使う（CSS不要）。

import * as fs from "fs";
import * as path from "path";

import { DEFAULT_GRADIENT_ANGLE } from "@/lib/gradient/build";
import { listGradientInputs } from "@/lib/gradient/registry";
import type { GradientTokenInput } from "@/lib/gradient/types";

const OUTPUT_PATH = "src/styles/gradient.css";

/** 角度ユーティリティ（静的）。0=上 / 90=右 / 135=右下(既定) / 180=下 … */
const DIRECTION_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const DIRECTION_LABEL: Record<number, string> = {
  0: "↑ 上",
  45: "↗ 右上",
  90: "→ 右",
  135: "↘ 右下（デフォルト）",
  180: "↓ 下",
  225: "↙ 左下",
  270: "← 左",
  315: "↖ 左上",
};

function section(title: string): string {
  const line = "═".repeat(75);
  return `/* ${line}\n   ${title}\n   ${line} */`;
}

/** group ごとにトークンをまとめる（宣言順を保持）。 */
function groupTokens(tokens: GradientTokenInput[]): Map<string, GradientTokenInput[]> {
  const groups = new Map<string, GradientTokenInput[]>();
  for (const token of tokens) {
    const key = token.group ?? "その他";
    const list = groups.get(key) ?? [];
    list.push(token);
    groups.set(key, list);
  }
  return groups;
}

function buildCss(tokens: GradientTokenInput[]): string {
  const grouped = groupTokens(tokens);
  const out: string[] = [];

  // ── ヘッダー ──
  out.push(
    [
      "/*",
      " * src/styles/gradient.css",
      " * 【自動生成ファイル】直接編集しないでください。",
      " * 生成元: src/lib/gradient/tokens.base.ts ＋ src/config/app/gradients.config.ts",
      " * 再生成: pnpm gradient:gen",
      " *",
      " * 使用例:",
      " *   <div className=\"bg-gradient-ocean gradient-90\" />",
      " *   <div className=\"bg-gradient-sunset gradient-180\" />",
      " */",
    ].join("\n"),
  );

  // ── :root 変数 ──
  out.push("");
  out.push(section("Variables"));
  out.push("");
  const rootLines: string[] = [":root {", "  /* デフォルト角度 */", `  --gradient-angle: ${DEFAULT_GRADIENT_ANGLE}deg;`];
  for (const [groupName, list] of grouped) {
    rootLines.push("");
    rootLines.push(`  /* ─── ${groupName} ─── */`);
    for (const token of list) {
      rootLines.push(`  --gradient-${token.key}-colors: ${token.stops.join(", ")};`);
    }
  }
  rootLines.push("}");
  out.push(rootLines.join("\n"));

  // ── .dark 上書き（darkStops を持つトークンのみ） ──
  const darkTokens = tokens.filter((t) => t.darkStops && t.darkStops.length > 0);
  if (darkTokens.length > 0) {
    const darkLines: string[] = [".dark {"];
    for (const token of darkTokens) {
      darkLines.push(`  --gradient-${token.key}-colors: ${token.darkStops!.join(", ")};`);
    }
    darkLines.push("}");
    out.push("");
    out.push(darkLines.join("\n"));
  }

  // ── 背景ユーティリティ ──
  out.push("");
  out.push(section("Background Utilities"));
  for (const [groupName, list] of grouped) {
    out.push("");
    out.push(`/* ─── ${groupName} ─── */`);
    for (const token of list) {
      out.push(
        `@utility bg-gradient-${token.key} {\n` +
          `  background: linear-gradient(var(--gradient-angle), var(--gradient-${token.key}-colors));\n` +
          `}`,
      );
    }
  }

  // ── 方向ユーティリティ（静的） ──
  out.push("");
  const dirHeader =
    "Direction Utilities（角度）\n\n" +
    "   角度の対応:\n" +
    DIRECTION_ANGLES.map((a) => `     ${String(a).padEnd(3)} = ${DIRECTION_LABEL[a]}`).join("\n");
  out.push(section(dirHeader));
  for (const angle of DIRECTION_ANGLES) {
    out.push(`@utility gradient-${angle} {\n  --gradient-angle: ${angle}deg;\n}`);
  }

  // ── テキストグラデーションユーティリティ（text: true のみ） ──
  const textTokens = tokens.filter((t) => t.text);
  if (textTokens.length > 0) {
    out.push("");
    out.push(section("Text Gradient Utilities"));
    for (const token of textTokens) {
      out.push(
        `@utility text-gradient-${token.key} {\n` +
          `  background: linear-gradient(var(--gradient-angle), var(--gradient-${token.key}-colors));\n` +
          `  -webkit-background-clip: text;\n` +
          `  -webkit-text-fill-color: transparent;\n` +
          `  background-clip: text;\n` +
          `}`,
      );
    }
  }

  return out.join("\n") + "\n";
}

function main(): void {
  const tokens = listGradientInputs();
  const css = buildCss(tokens);
  const outPath = path.resolve(process.cwd(), OUTPUT_PATH);
  fs.writeFileSync(outPath, css, "utf8");
  console.log(`✓ ${OUTPUT_PATH} を生成しました（${tokens.length} トークン）`);
}

main();
