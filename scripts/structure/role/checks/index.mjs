// role:generate の前の検査（何も書く前に止めるもの）。ロール設定とプロフィール設定の決まりを集め、全件を並べて例外にする。
// 対話で作っていた頃に質問の中にあった決まりをここに移した（role.json・profile.json は手で書き、role:generate で生成する）。
// 止めない食い違いは roleConfigWarnings（生成は進める）

import { auditIssues } from "../../domain/checks/audit.mjs";
import { formInputNameIssues } from "../../domain/checks/formInputNames.mjs";
import { profileFieldIssues, profileTagIssues, profileWarnings } from "./profile.mjs";
import { profileRelationIssues } from "./relations.mjs";
import { roleIssues, roleWarnings } from "./role.mjs";

export { roleFolderIssues } from "./role.mjs";

/**
 * @typedef {object} RoleCheckInput
 * @property {string} fileName ロール設定のファイル名（例: admin.role.json）
 * @property {object} role ロール設定
 * @property {object | null} profile プロフィール設定（無ければ null）
 * @property {Set<string>} [registeredInputs] 登録された入力部品の名前
 * @property {string[]} [overrideProblems] 隣の上書きを読んだときの問題（role と profile は上書き後の値）
 */

/**
 * @param {RoleCheckInput} input
 * @returns {string[]} [<file>] を前に付けた問題（空なら無し）
 */
export function roleConfigIssues({ fileName, role, profile, overrideProblems = [], registeredInputs = new Set() }) {
  const profileName = `${role?.id}.profile.json`;
  const issues = [...overrideProblems, ...roleIssues({ fileName, role, profileExists: profile !== null }).map((issue) => `[${fileName}] ${issue}`)];
  // hasProfile: false のプロフィールは生成しないので項目は検査しない（警告だけ）
  if (profile !== null && role?.hasProfile === true) {
    issues.push(
      ...[...profileFieldIssues(profile), ...formInputNameIssues(profile, registeredInputs), ...profileRelationIssues(profile, registeredInputs), ...profileTagIssues(profile), ...auditIssues(profile, "Neon")].map((issue) => `[${profileName}] ${issue}`),
    );
  }
  return issues;
}

/** 問題があれば全件を並べて例外を投げる（role:generate の入口） */
export function assertRoleConfig(input) {
  const issues = roleConfigIssues(input);
  if (issues.length > 0) throw new Error(issues.join("\n"));
}

/**
 * @param {RoleCheckInput} input
 * @returns {string[]} [<file>] を前に付けた警告
 */
export function roleConfigWarnings({ fileName, role, profile, registeredInputs = new Set() }) {
  const warnings = roleWarnings({ role, profileExists: profile !== null }).map((w) => `[${fileName}] ${w}`);
  if (profile !== null && role?.hasProfile === true) warnings.push(...profileWarnings(profile, registeredInputs).map((w) => `[${role.id}.profile.json] ${w}`));
  return warnings;
}

/**
 * プロフィール設定だけあってロール設定が無いもの（生成されない）
 * @param {string[]} roleIds ロール設定のある ID
 * @param {string[]} profileIds プロフィール設定のある ID
 * @returns {string[]} 問題
 */
export function orphanProfileIssues(roleIds, profileIds) {
  const roles = new Set(roleIds);
  return profileIds.filter((id) => !roles.has(id)).map((id) => `[${id}.profile.json] ロール設定 ${id}.role.json がありません（ロールを作るかプロフィール設定を消す）`);
}
