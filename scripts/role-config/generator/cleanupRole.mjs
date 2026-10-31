// scripts/role-config/generator/cleanupRole.mjs
// ロールを一覧から外す

import { assertHasProfileNotOverridden, cleanupProfile } from "./cleanupProfile.mjs";
import { removeRoleFromList } from "./writeLists.mjs";

/**
 * ロール関連のレジストリエントリをクリーンアップ
 * @param {string} roleId - ロールID
 * @param {Object} options - オプション
 * @param {boolean} options.includeProfile - プロフィールも削除するか（デフォルト: true）
 * @param {boolean} options.deleteEntity - エンティティファイルも削除するか（デフォルト: true）
 * @param {boolean} options.updateHasProfile - hasProfile を false に更新するか（デフォルト: true）
 * @param {boolean} options.silent - ログ出力を抑制するか（デフォルト: false）
 */
export function cleanupRole(roleId, options = {}) {
  const { includeProfile = true, deleteEntity = true, updateHasProfile = true, silent = false } = options;

  const log = silent ? () => {} : console.log;

  if (includeProfile && updateHasProfile) assertHasProfileNotOverridden(roleId);

  log(`ロール "${roleId}" のクリーンアップ中...`);

  const results = {
    roleList: removeRoleFromList(roleId),
    profile: null,
  };

  if (!silent && results.roleList) {
    log("  ✓ user/extensions/roles.ts を更新");
  }

  // プロフィール関連も削除
  if (includeProfile) {
    results.profile = cleanupProfile(roleId, { deleteEntity, updateHasProfile, silent: true });

    if (!silent) {
      if (results.profile.generatedFolder) log("  ✓ entities/profiles/ のフォルダを削除");
    }
  }

  if (!silent) {
    const anyModified = results.roleList ||
      (results.profile && Object.values(results.profile).some(Boolean));
    if (!anyModified) {
      log("  （削除対象のエントリはありませんでした）");
    }
  }

  return results;
}
