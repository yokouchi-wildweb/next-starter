// scripts/role-config/generator/cleanupRole.mjs
// ロール関連のレジストリエントリを削除

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";
import { cleanupProfile } from "./cleanupProfile.mjs";

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
 * roleRegistry.ts からエントリを削除
 */
function cleanupRoleRegistry(roleId) {
  const filePath = path.join(ROOT_DIR, "src/registry/roleRegistry.ts");

  const varName = `${toCamelCase(roleId)}Role`;
  // 通常ロールとコアロール両方のパターンに対応
  const patterns = [
    `import ${varName} from "@/features/core/user/roles/${roleId}.role.json"`,
    `import ${varName} from "@/features/core/user/roles/_${roleId}.role.json"`,
    `${varName} as RoleConfig`,
  ];

  return removeLines(filePath, patterns);
}

/**
 * ロール関連のレジストリエントリをクリーンアップ
 * @param {string} roleId - ロールID
 * @param {Object} options - オプション
 * @param {boolean} options.includeProfile - プロフィールも削除するか（デフォルト: true）
 * @param {boolean} options.deleteEntity - エンティティファイルも削除するか（デフォルト: true）
 * @param {boolean} options.silent - ログ出力を抑制するか（デフォルト: false）
 */
export function cleanupRole(roleId, options = {}) {
  const { includeProfile = true, deleteEntity = true, silent = false } = options;

  const log = silent ? () => {} : console.log;

  log(`ロール "${roleId}" のクリーンアップ中...`);

  const results = {
    roleRegistry: cleanupRoleRegistry(roleId),
    profile: null,
  };

  if (!silent && results.roleRegistry) {
    log("  ✓ roleRegistry.ts を更新");
  }

  // プロフィール関連も削除
  if (includeProfile) {
    results.profile = cleanupProfile(roleId, { deleteEntity, silent: true });

    if (!silent) {
      if (results.profile.profilesIndex) log("  ✓ profiles/index.ts を更新");
      if (results.profile.profileBaseRegistry) log("  ✓ profileBaseRegistry.ts を更新");
      if (results.profile.profileTableRegistry) log("  ✓ profileTableRegistry.ts を更新");
      if (results.profile.generatedFolder) log("  ✓ generated/ フォルダを削除");
    }
  }

  if (!silent) {
    const anyModified = results.roleRegistry ||
      (results.profile && Object.values(results.profile).some(Boolean));
    if (!anyModified) {
      log("  （削除対象のエントリはありませんでした）");
    }
  }

  return results;
}
