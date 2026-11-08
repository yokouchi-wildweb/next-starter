// scripts/operations/business/lib.ts — 事業の素性の初期化の道具の共通部品(pnpm ops business from-example | blank)
// src/business/business.ts を own の形で書き出す。既に own なら --force が無い限り書かない(fork の値を消さない)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BusinessValues } from "@/lib/business";

export const BUSINESS_FILE = "src/business/business.ts";

const HEADER = `// src/business/business.ts — このプロジェクトの事業の素性(fork の物。フォルダごと fork が書く)
// own = この値を @/business が返す(全部の欄が必須)。例の値は src/lib/business/examples/business.ts(変更履歴は examples/CHANGELOG.md)。形: src/lib/business/README.md
import type { BusinessFile } from "@/lib/business";
`;

/** own の business.ts の本文 */
export function ownFileText(values: BusinessValues): string {
  const body = JSON.stringify({ source: "own", values }, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, "$1:");
  return `${HEADER}\nexport default ${body} satisfies BusinessFile;\n`;
}

/** 全部の欄を空にした値(形は例の値と同じ) */
export function blankValues(example: BusinessValues): BusinessValues {
  const blank = (value: unknown): unknown => {
    if (typeof value === "string") return "";
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blank(v)]));
    return value;
  };
  // 既定のロゴの種類は名前なので空にしない(空の文字は型に合わない)
  return { ...(blank(example) as BusinessValues), logo: { variants: blank(example.logo.variants) as BusinessValues["logo"]["variants"], defaultVariant: example.logo.defaultVariant } };
}

/** 書く。既に own なら force でない限り書かずに false */
export function writeOwnFile(root: string, text: string, force: boolean): { written: boolean; reason: string | null } {
  const file = path.join(root, BUSINESS_FILE);
  if (existsSync(file) && /\bsource\s*:\s*["']own["']/.test(readFileSync(file, "utf8")) && !force) {
    return { written: false, reason: `${BUSINESS_FILE} は既に source: "own" です(上書きするなら --force)` };
  }
  writeFileSync(file, text);
  return { written: true, reason: null };
}
