// scripts/role-config/generator/cleanupProfile.mjs
// プロフィール関連のレジストリエントリを削除

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");

/**
 * ファイルから特定パターンの行を削除
 */
function removeLines(filePath, patterns) {
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;

  for (const pattern of patterns) {
    const regex = new RegExp(`^.*${escapeRegex(pattern)}.*\n?`, "gm");
    const newContent = content.replace(regex, "");
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  if (modified) {
    // 連続する空行を1つにまとめる
    content = content.replace(/\n{3,}/g, "\n\n");
    fs.writeFileSync(filePath, content);
  }

  return modified;
}

/**
 * 正規表現の特殊文字をエスケープ
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * profiles/index.ts からエントリを削除
 */
function cleanupProfilesIndex(roleId) {
  const filePath = path.join(
    ROOT_DIR,
    "src/features/core/userProfile/profiles/index.ts"
  );

  const varName = `${toCamelCase(roleId)}Profile`;
  const patterns = [
    `import ${varName} from "./${roleId}.profile.json"`,
    `${varName} as ProfileConfig`,
  ];

  return removeLines(filePath, patterns);
}

/**
 * profileBaseRegistry.ts からエントリを削除
 */
function cleanupProfileBaseRegistry(roleId) {
  const filePath = path.join(ROOT_DIR, "src/registry/profileBaseRegistry.ts");

  const tableVar = `${toPascalCase(roleId)}ProfileTable`;
  const patterns = [
    `import { ${tableVar} }`,
    `${roleId}: createProfileBase(${tableVar})`,
  ];

  return removeLines(filePath, patterns);
}

/**
 * profileTableRegistry.ts からエントリを削除
 */
function cleanupProfileTableRegistry(roleId) {
  const filePath = path.join(ROOT_DIR, "src/registry/profileTableRegistry.ts");

  const entityFileName = `${toCamelCase(roleId)}Profile`;
  const patterns = [
    `export * from "@/features/core/userProfile/entities/${entityFileName}"`,
  ];

  return removeLines(filePath, patterns);
}

/**
 * エンティティファイルを削除
 */
function cleanupEntityFile(roleId) {
  const entityFileName = `${toCamelCase(roleId)}Profile.ts`;
  const filePath = path.join(
    ROOT_DIR,
    "src/features/core/userProfile/entities",
    entityFileName
  );

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * プロフィール関連のレジストリエントリをクリーンアップ
 * @param {string} roleId - ロールID
 * @param {Object} options - オプション
 * @param {boolean} options.deleteEntity - エンティティファイルも削除するか（デフォルト: true）
 * @param {boolean} options.silent - ログ出力を抑制するか（デフォルト: false）
 */
export function cleanupProfile(roleId, options = {}) {
  const { deleteEntity = true, silent = false } = options;

  const log = silent ? () => {} : console.log;

  log(`プロフィール "${roleId}" のクリーンアップ中...`);

  const results = {
    profilesIndex: cleanupProfilesIndex(roleId),
    profileBaseRegistry: cleanupProfileBaseRegistry(roleId),
    profileTableRegistry: cleanupProfileTableRegistry(roleId),
    entityFile: deleteEntity ? cleanupEntityFile(roleId) : false,
  };

  if (!silent) {
    if (results.profilesIndex) log("  ✓ profiles/index.ts を更新");
    if (results.profileBaseRegistry) log("  ✓ profileBaseRegistry.ts を更新");
    if (results.profileTableRegistry) log("  ✓ profileTableRegistry.ts を更新");
    if (results.entityFile) log("  ✓ エンティティファイルを削除");

    const anyModified = Object.values(results).some(Boolean);
    if (!anyModified) {
      log("  （削除対象のエントリはありませんでした）");
    }
  }

  return results;
}
