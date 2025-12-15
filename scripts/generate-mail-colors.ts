// scripts/generate-mail-colors.ts
// theme.cssからテーマカラーを抽出し、メール用の定数ファイルを生成するスクリプト
//
// 使い方:
//   npx tsx scripts/generate-mail-colors.ts
//
// 出力先:
//   src/features/core/mail/constants/colors.ts

import * as fs from "fs";
import * as path from "path";
import { formatHex, parse } from "culori";

const THEME_CSS_PATH = "src/styles/theme.css";
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

/**
 * CSSファイルから:rootセクションの変数を抽出
 */
function extractRootVariables(css: string): Map<string, string> {
  const variables = new Map<string, string>();

  // :root { ... } セクションを抽出
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) {
    console.error(":root セクションが見つかりませんでした");
    return variables;
  }

  const rootContent = rootMatch[1];

  // 各変数を抽出
  const varRegex = /--([a-z-]+):\s*([^;]+);/g;
  let match;
  while ((match = varRegex.exec(rootContent)) !== null) {
    const [, name, value] = match;
    variables.set(name, value.trim());
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
    "// 生成元: src/styles/theme.css",
    "// 生成コマンド: npx tsx scripts/generate-mail-colors.ts",
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
  console.log(`入力: ${THEME_CSS_PATH}`);
  console.log(`出力: ${OUTPUT_PATH}`);
  console.log("");

  // CSSファイルを読み込み
  const cssPath = path.resolve(process.cwd(), THEME_CSS_PATH);
  if (!fs.existsSync(cssPath)) {
    console.error(`エラー: ${THEME_CSS_PATH} が見つかりません`);
    process.exit(1);
  }

  const css = fs.readFileSync(cssPath, "utf-8");

  // :rootから変数を抽出
  const allVariables = extractRootVariables(css);
  console.log(`抽出した変数: ${allVariables.size}個`);

  // 対象の変数のみフィルタしてhexに変換
  const colors = new Map<string, string>();

  for (const varName of TARGET_VARIABLES) {
    const oklchValue = allVariables.get(varName);
    if (!oklchValue) {
      console.warn(`警告: --${varName} が見つかりません`);
      continue;
    }

    const hex = oklchToHex(oklchValue);
    if (!hex) {
      console.warn(`警告: --${varName} の変換に失敗しました: ${oklchValue}`);
      continue;
    }

    colors.set(varName, hex);
    console.log(`  --${varName}: ${oklchValue} → ${hex}`);
  }

  console.log("");
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
