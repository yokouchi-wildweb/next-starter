// scripts/structure/role/generator/cleanupProfile.mjs
// プロフィールの生成フォルダを消し、一覧を作り直す

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { overrideFileName, readRoleOverride, requireOverride, writeRoleOverrideKey } from "../overrides.mjs";
import { findRoleFile, parentOwns } from "../rolePaths.mjs";
import { writeProfileLists } from "./writeLists.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../../..");

/**
 * entities/profiles/{roleId}/ フォルダを削除
 */
function cleanupGeneratedFolder(roleId) {
  const folderPath = path.join(
    ROOT_DIR,
    "src/domains/core/userProfile/entities/profiles",
    roleId
  );

  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true });
    return true;
  }
  return false;
}

/**
 * 自分の JSON に書くロールで、上書きが hasProfile を決めていれば JSON を書いても効かないので、何も消す前に止める
 * (fork で親の持ち物の追加ロールは上書きに書くので止めない。core ロールは今どおり止める)
 */
export function assertHasProfileNotOverridden(roleId) {
  const file = findRoleFile(roleId);
  if (file && (file.isCore || !parentOwns(file.filePath)) && requireOverride(readRoleOverride(file)).hasProfile !== undefined) {
    throw new Error(`ロール「${roleId}」の hasProfile は ${overrideFileName(file.fileName)} が決めています。そのファイルを直してから実行してください。`);
  }
}

/**
 * ロールの hasProfile を false に更新。持ち主で書く所を決める: 自分の JSON はそのまま、fork で親の持ち物は隣の上書き
 * (CLAUDE.md ROLES・CORE_FILES)。core ロールは今どおり書かない(hasProfile は上書きで決まる)
 */
function updateRoleHasProfile(roleId) {
  const file = findRoleFile(roleId);
  if (!file || file.isCore) return false;
  if (parentOwns(file.filePath)) {
    const override = requireOverride(readRoleOverride(file));
    const current = override.hasProfile ?? JSON.parse(fs.readFileSync(file.filePath, "utf-8")).hasProfile;
    if (current === false) return false;
    writeRoleOverrideKey(file, "hasProfile", false);
    return true;
  }
  const targetPath = file.filePath;

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

  if (updateHasProfile) assertHasProfileNotOverridden(roleId);

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
