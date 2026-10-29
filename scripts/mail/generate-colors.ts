// scripts/mail/generate-colors.ts
// 色トークン(CSS)からメール用のカラー定数ファイルを生成するスクリプト。
//
// 色の正は CSS(src/styles/_base/palette.defaults.css + src/styles/palette.css)。
// 上流既定値を読み、下流の上書きを後勝ちで合成してから hex に変換する。
// メールはエリア(data-area)もダークモードも持たないため、`:root` ブロックだけを対象にする。
//
// 使い方:
//   pnpm mail:generate-colors
//
// 出力先:
//   src/features/core/mail/constants/colors.ts
//
// 必要な変数が 1 つでも欠けていれば、ファイルを書き出す前に失敗する(壊れた定数を出荷しない)。

import * as fs from "fs";
import * as path from "path";
import { formatHex, parse } from "culori";

/** 読み込み順 = 優先度(後のファイルが前を上書き) */
const INPUT_CSS_PATHS = [
  "src/styles/_base/palette.defaults.css", // 上流既定値(必須)
  "src/styles/palette.css", // 下流の上書き(無ければ無視)
] as const;
const OUTPUT_PATH = "src/features/core/mail/constants/colors.ts";

// 抽出対象のCSS変数名（メールで使用するもののみ）
const TARGET_VARIABLES = [
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "background",
  "foreground",
  "border",
] as const;

/**
 * CSS変数名をキャメルケースに変換
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

/**
 * oklch値をhex値に変換
 */
function oklchToHex(oklchValue: string): string | null {
  try {
    const parsed = parse(oklchValue);
    if (!parsed) return null;
    const hex = formatHex(parsed);
    return hex ?? null;
  } catch {
    return null;
  }
}

/** コメントを除去する(palette.css の説明コメントに書かれた例を拾わないため) */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * CSS 文字列の全 `:root { ... }` ブロックから変数を抽出する(同名は後勝ち)。
 * `.dark` や `[data-area=...]` のブロックは対象外。
 */
function extractRootVariables(css: string): Map<string, string> {
  const variables = new Map<string, string>();
  const source = stripComments(css);

  const rootBlockRegex = /:root\s*\{([^}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = rootBlockRegex.exec(source)) !== null) {
    const varRegex = /--([a-z0-9-]+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;
    while ((match = varRegex.exec(block[1])) !== null) {
      const [, name, value] = match;
      variables.set(name, value.trim());
    }
  }

  return variables;
}

/**
 * 定数ファイルの内容を生成
 */
function generateColorsFile(colors: Map<string, string>): string {
  const lines: string[] = [
    "// src/features/core/mail/constants/colors.ts",
    "// このファイルは自動生成されます。直接編集しないでください。",
    `// 生成元: ${INPUT_CSS_PATHS.join(" + ")} (後者が前者を上書き)`,
    "// 生成コマンド: pnpm mail:generate-colors",
    "",
    "export const MAIL_THEME_COLORS = {",
  ];

  for (const [name, hex] of colors) {
    const camelName = toCamelCase(name);
    lines.push(`  /** --${name} */`);
    lines.push(`  ${camelName}: "${hex}",`);
  }

  lines.push("} as const;");
  lines.push("");
  lines.push("export type MailThemeColorKey = keyof typeof MAIL_THEME_COLORS;");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("=== メール用テーマカラー生成 ===");
  console.log(`入力: ${INPUT_CSS_PATHS.join(" → ")}`);
  console.log(`出力: ${OUTPUT_PATH}`);
  console.log("");

  // 上流既定値 → 下流上書きの順に読み、後勝ちで合成する
  const merged = new Map<string, string>();
  INPUT_CSS_PATHS.forEach((relPath, index) => {
    const cssPath = path.resolve(process.cwd(), relPath);
    const isRequired = index === 0;
    if (!fs.existsSync(cssPath)) {
      if (isRequired) {
        console.error(`エラー: ${relPath} が見つかりません`);
        process.exit(1);
      }
      console.log(`  (${relPath} は無いのでスキップ)`);
      return;
    }
    const vars = extractRootVariables(fs.readFileSync(cssPath, "utf-8"));
    console.log(`  ${relPath}: ${vars.size}個の変数`);
    for (const [name, value] of vars) merged.set(name, value);
  });
  console.log("");

  // 対象の変数のみ hex に変換。欠落・変換失敗はエラーとして収集し、書き出し前に失敗させる
  const colors = new Map<string, string>();
  const errors: string[] = [];

  for (const varName of TARGET_VARIABLES) {
    const cssValue = merged.get(varName);
    if (!cssValue) {
      errors.push(`--${varName} が :root に定義されていません`);
      continue;
    }

    const hex = oklchToHex(cssValue);
    if (!hex) {
      errors.push(`--${varName} の変換に失敗しました: ${cssValue}`);
      continue;
    }

    colors.set(varName, hex);
    console.log(`  --${varName}: ${cssValue} → ${hex}`);
  }

  console.log("");
  if (errors.length > 0) {
    console.error("エラー: 以下の変数が解決できないため生成を中止しました(出力ファイルは更新していません)");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`変換成功: ${colors.size}/${TARGET_VARIABLES.length}個`);

  // ファイルを生成
  const outputPath = path.resolve(process.cwd(), OUTPUT_PATH);
  const content = generateColorsFile(colors);
  fs.writeFileSync(outputPath, content, "utf-8");

  console.log("");
  console.log(`生成完了: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
