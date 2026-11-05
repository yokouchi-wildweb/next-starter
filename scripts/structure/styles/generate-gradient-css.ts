// scripts/structure/styles/generate-gradient-css.ts
// グラデーショントークンから CSS を 2 本生成する(既定と実効の対):
//   - src/styles/core/gradient.default.css = 上流の既定(BASE_GRADIENTS)+ 角度ユーティリティ。upstream 所有、fork でも上流と同じ中身
//   - src/styles/gradient.css             = そのリポの分(src/config/app/gradients.config.ts の customGradients)。fork 所有、global.css が読む
//   fork は core/ の下に差分を持たない。同じ key を customGradients に書けば、直下の gradient.css が後から読まれて上書きする
//
// 使い方:
//   pnpm gradient:gen
//
// 方針（生成物コミット方式）:
//   - 単一ソースは TS（tokens.base.ts ＋ config/app/gradients.config.ts）。
//   - 本スクリプトで 2 本を生成し、生成物を git にコミットする。
//   - これにより Vercel など本番ビルドは生成済みCSSをそのまま使い、ビルド手順は不変。
//   - 実行時用途（ピッカー / inline style / canvas）は listGradients() を直接使う（CSS不要）。

import * as fs from "fs";
import * as path from "path";

import { DEFAULT_GRADIENT_ANGLE } from "@/lib/gradient/build";
import { BASE_GRADIENTS } from "@/lib/gradient/tokens.base";
import type { GradientTokenInput } from "@/lib/gradient/types";
import { customGradients } from "@/config/app/gradients.config";

const DEFAULT_OUTPUT_PATH = "src/styles/core/gradient.default.css";
const REPO_OUTPUT_PATH = "src/styles/gradient.css";

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

type BuildOptions = {
  /** ファイル冒頭のコメント(1 行ずつ、` * ` は付けない) */
  header: string[];
  /** 既定角度の変数と角度ユーティリティを書くか(上流の既定の側だけ) */
  withAngles: boolean;
};

function buildCss(tokens: GradientTokenInput[], options: BuildOptions): string {
  const grouped = groupTokens(tokens);
  const out: string[] = [];

  // ── ヘッダー ──
  out.push(["/*", ...options.header.map((line) => (line ? ` * ${line}` : " *")), " */"].join("\n"));

  // そのリポの分が空なら変数もユーティリティも書かない(ヘッダーだけ)
  if (tokens.length === 0 && !options.withAngles) {
    return out.join("\n") + "\n";
  }

  // ── :root 変数 ──
  out.push("");
  out.push(section("Variables"));
  out.push("");
  const rootLines: string[] = [":root {"];
  if (options.withAngles) {
    rootLines.push("  /* デフォルト角度 */", `  --gradient-angle: ${DEFAULT_GRADIENT_ANGLE}deg;`);
  }
  for (const [groupName, list] of grouped) {
    if (rootLines.length > 1) rootLines.push("");
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

  // ── 方向ユーティリティ（静的。上流の既定の側だけ） ──
  if (options.withAngles) {
    out.push("");
    const dirHeader =
      "Direction Utilities（角度）\n\n" +
      "   角度の対応:\n" +
      DIRECTION_ANGLES.map((a) => `     ${String(a).padEnd(3)} = ${DIRECTION_LABEL[a]}`).join("\n");
    out.push(section(dirHeader));
    for (const angle of DIRECTION_ANGLES) {
      out.push(`@utility gradient-${angle} {\n  --gradient-angle: ${angle}deg;\n}`);
    }
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

const USAGE = [
  "",
  "使用例:",
  '  <div className="bg-gradient-ocean gradient-90" />',
  '  <div className="bg-gradient-sunset gradient-180" />',
];

function write(relPath: string, css: string, count: number): void {
  fs.writeFileSync(path.resolve(process.cwd(), relPath), css, "utf8");
  console.log(`✓ ${relPath} を生成しました（${count} トークン）`);
}

function main(): void {
  write(
    DEFAULT_OUTPUT_PATH,
    buildCss(BASE_GRADIENTS, {
      header: [
        DEFAULT_OUTPUT_PATH,
        "【自動生成ファイル】直接編集しないでください。上流の既定(upstream 所有。fork でも上流と同じ中身)。",
        "生成元: src/lib/gradient/tokens.base.ts",
        "再生成: pnpm gradient:gen(そのリポの分は直下の src/styles/gradient.css)",
        ...USAGE,
      ],
      withAngles: true,
    }),
    BASE_GRADIENTS.length,
  );
  write(
    REPO_OUTPUT_PATH,
    buildCss(customGradients, {
      header: [
        REPO_OUTPUT_PATH,
        "【自動生成ファイル】直接編集しないでください。このリポのグラデーション(fork 所有。global.css が読む)。",
        "生成元: src/config/app/gradients.config.ts の customGradients(空なら中身なし)",
        "再生成: pnpm gradient:gen。上流の既定(core/gradient.default.css)の後に読まれ、同じ key は上書きする",
      ],
      withAngles: false,
    }),
    customGradients.length,
  );
}

main();
