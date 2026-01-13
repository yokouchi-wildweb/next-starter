// scripts/role-config/generator/updateProfilesIndex.mjs
// profiles/index.ts の更新

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const PROFILES_INDEX_PATH = path.join(
  ROOT_DIR,
  "src/features/core/userProfile/profiles/index.ts"
);

/**
 * profiles/index.ts にプロフィールを追加
 *
 * 処理:
 * 1. import 文を追加
 * 2. ALL_PROFILES 配列に追加
 */
export function updateProfilesIndex(roleConfig) {
  let content = fs.readFileSync(PROFILES_INDEX_PATH, "utf-8");
  const roleId = roleConfig.id;
  const varName = `${toCamelCase(roleId)}Profile`;

  // 1. import 文を追加
  const importLine = `import ${varName} from "./${roleId}.profile.json";`;

  // 最後の JSON import を探して、その後に追加
  const importMatch = content.match(
    /(import \w+Profile from "\.\/[\w-]+\.profile\.json";)/g
  );

  if (importMatch) {
    const lastImport = importMatch[importMatch.length - 1];
    content = content.replace(lastImport, lastImport + "\n" + importLine);
  } else {
    // フォールバック: ProfileFieldConfig import の後に追加
    content = content.replace(
      /(import type { ProfileFieldConfig } from "[^"]+";)/,
      `$1\n\n// JSON プロフィール設定の読み込み\n${importLine}`
    );
  }

  // 2. ALL_PROFILES 配列に追加
  const allProfilesMatch = content.match(
    /(export const ALL_PROFILES: readonly ProfileConfig\[\] = \[[\s\S]*?)(];)/
  );

  if (allProfilesMatch) {
    const [fullMatch, arrayContent, closingBracket] = allProfilesMatch;
    const newEntry = `  ${varName} as ProfileConfig,\n`;
    // 既存のエントリの後に追加
    const newContent = arrayContent + newEntry + closingBracket;
    content = content.replace(fullMatch, newContent);
  }

  fs.writeFileSync(PROFILES_INDEX_PATH, content);
}
