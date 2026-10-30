// scripts/role-config/generator/cleanupProfile.mjs
// プロフィールの生成フォルダを消し、一覧を作り直す

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { writeProfileLists } from "./writeLists.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");

/**
 * entities/profiles/{roleId}/ フォルダを削除
 */
function cleanupGeneratedFolder(roleId) {
  const folderPath = path.join(
    ROOT_DIR,
    "src/features/core/userProfile/entities/profiles",
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
    generatedFolder: deleteEntity ? cleanupGeneratedFolder(roleId) : false,
    roleHasProfile: updateHasProfile ? updateRoleHasProfile(roleId) : false,
  };

  // 一覧は生成フォルダのあるプロフィールだけを並べる
  writeProfileLists();

  if (!silent) {
    if (results.generatedFolder) log("  ✓ entities/profiles/ のフォルダを削除");
    if (results.roleHasProfile) log("  ✓ ロール設定の hasProfile を false に更新");

    const anyModified = Object.values(results).some(Boolean);
    if (!anyModified) {
      log("  （削除対象のエントリはありませんでした）");
    }
  }

  return results;
}
