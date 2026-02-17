// scripts/role-config/generator/cleanupProfile.mjs
// プロフィール関連のレジストリエントリを削除

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase, toPascalCase } from "../../../src/utils/stringCase.mjs";
import { updateGeneratedIndex } from "./updateGeneratedIndex.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");

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

  const patterns = [
    `export * from "@/features/core/userProfile/generated/${roleId}"`,
  ];

  return removeLines(filePath, patterns);
}

/**
 * profileSchemaRegistry.ts からエントリを削除
 */
function cleanupProfileSchemaRegistry(roleId) {
  const filePath = path.join(ROOT_DIR, "src/registry/profileSchemaRegistry.ts");

  const schemaName = `${toPascalCase(roleId)}ProfileSchema`;
  const patterns = [
    `import { ${schemaName} }`,
    `${roleId}: ${schemaName}`,
  ];

  return removeLines(filePath, patterns);
}

/**
 * generated/{roleId}/ フォルダを削除
 */
function cleanupGeneratedFolder(roleId) {
  const folderPath = path.join(
    ROOT_DIR,
    "src/features/core/userProfile/generated",
    roleId
  );

  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * ロール設定ファイルの hasProfile を false に更新
 */
function updateRoleHasProfile(roleId) {
  // 通常のロールファイルとコアロールファイルの両方をチェック
  const rolePath = path.join(ROLES_DIR, `${roleId}.role.json`);
  const coreRolePath = path.join(ROLES_DIR, `_${roleId}.role.json`);

  let targetPath = null;
  if (fs.existsSync(rolePath)) {
    targetPath = rolePath;
  } else if (fs.existsSync(coreRolePath)) {
    targetPath = coreRolePath;
  }

  if (!targetPath) return false;

  const config = JSON.parse(fs.readFileSync(targetPath, "utf-8"));
  if (config.hasProfile === false) return false;

  config.hasProfile = false;
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2) + "\n");
  return true;
}

/**
 * プロフィール関連のレジストリエントリをクリーンアップ
 * @param {string} roleId - ロールID
 * @param {Object} options - オプション
 * @param {boolean} options.deleteEntity - 生成フォルダも削除するか（デフォルト: true）
 * @param {boolean} options.updateHasProfile - hasProfile を false に更新するか（デフォルト: true）
 * @param {boolean} options.silent - ログ出力を抑制するか（デフォルト: false）
 */
export function cleanupProfile(roleId, options = {}) {
  const { deleteEntity = true, updateHasProfile = true, silent = false } = options;

  const log = silent ? () => {} : console.log;

  log(`プロフィール "${roleId}" のクリーンアップ中...`);

  const results = {
    profilesIndex: cleanupProfilesIndex(roleId),
    profileBaseRegistry: cleanupProfileBaseRegistry(roleId),
    profileTableRegistry: cleanupProfileTableRegistry(roleId),
    profileSchemaRegistry: cleanupProfileSchemaRegistry(roleId),
    generatedFolder: deleteEntity ? cleanupGeneratedFolder(roleId) : false,
    roleHasProfile: updateHasProfile ? updateRoleHasProfile(roleId) : false,
  };

  // generated/index.ts を更新（フォルダ削除後）
  if (results.generatedFolder) {
    updateGeneratedIndex();
  }

  if (!silent) {
    if (results.profilesIndex) log("  ✓ profiles/index.ts を更新");
    if (results.profileBaseRegistry) log("  ✓ profileBaseRegistry.ts を更新");
    if (results.profileTableRegistry) log("  ✓ profileTableRegistry.ts を更新");
    if (results.profileSchemaRegistry) log("  ✓ profileSchemaRegistry.ts を更新");
    if (results.generatedFolder) log("  ✓ generated/ フォルダを削除");
    if (results.roleHasProfile) log("  ✓ ロール設定の hasProfile を false に更新");

    const anyModified = Object.values(results).some(Boolean);
    if (!anyModified) {
      log("  （削除対象のエントリはありませんでした）");
    }
  }

  return results;
}
