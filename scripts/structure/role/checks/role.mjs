// 検査: ロール設定（<id>.role.json）の形と、プロフィール設定（<id>.profile.json）との対応。
// 生成器は JSON を読むだけで、ID の形・ファイル名・category・hasProfile を誰も確かめていなかった（対話の質問の中にだけあった）。
// ファイル名がずれると user/extensions/roles.ts の import が壊れ、hasProfile とプロフィール設定がずれると黙って生成を飛ばすので止める。
// 規則の正: src/features/core/user/README.md（ロール設定）、src/features/core/userProfile/README.md（プロフィール設定）

import { CORE_ROLE_IDS } from "../rolePaths.mjs";

/** ロール ID の形（列名・変数名・パスに使う） */
const ROLE_ID = /^[a-z][a-z0-9_]*$/;
const CATEGORIES = new Set(["user", "admin"]);

/**
 * core ロールの置き場: coreRoles/ は上流の 3 つだけ、roles/ に core の ID は置けない
 * @param {{ coreFileNames: string[], addedFileNames: string[] }} input
 * @returns {string[]} 問題（空なら無し）
 */
export function roleFolderIssues({ coreFileNames, addedFileNames }) {
  const issues = [];
  const coreNames = CORE_ROLE_IDS.map((id) => `${id}.role.json`);
  for (const name of coreFileNames) {
    if (!coreNames.includes(name)) issues.push(`[coreRoles/${name}] coreRoles/ は ${CORE_ROLE_IDS.join("・")} だけです（足すロールは roles/ に置く）`);
  }
  for (const name of coreNames) {
    if (!coreFileNames.includes(name)) issues.push(`[coreRoles/${name}] core ロールの設定がありません（消せません）`);
    if (addedFileNames.includes(name)) issues.push(`[roles/${name}] core ロールと同じ ID です（表示名とプロフィールの有無は coreRoles/${name.replace(/\.json$/, ".override.ts")} で変える）`);
  }
  return issues;
}

/**
 * @param {{ fileName: string, role: object, profileExists: boolean }} input
 *   fileName = ロール設定のファイル名、profileExists = <id>.profile.json があるか
 * @returns {string[]} 問題（空なら無し）
 */
export function roleIssues({ fileName, role, profileExists }) {
  const issues = [];
  if (!role || typeof role !== "object") return [`${fileName}: JSON のオブジェクトにしてください`];
  const { id } = role;
  if (typeof id !== "string" || !ROLE_ID.test(id)) {
    issues.push(`id ${JSON.stringify(id)} は英小文字で始まる英小文字・数字・_ にしてください（例: reviewer。_ 始まりは不可）`);
  } else {
    const expected = `${id}.role.json`;
    if (fileName !== expected) issues.push(`ファイル名 ${fileName} は ${expected} にしてください（user/extensions/roles.ts の import がこの名前を使います）`);
  }
  if (role.isCore !== undefined) issues.push("isCore は廃止しました（消してください。core ロールは coreRoles/ の 3 つです）");
  if (!CATEGORIES.has(role.category)) issues.push(`category は "user" か "admin" にしてください（今: ${JSON.stringify(role.category)}）`);
  if (typeof role.hasProfile !== "boolean") {
    issues.push(`hasProfile は true か false で書いてください（今: ${JSON.stringify(role.hasProfile)}）`);
  } else if (role.hasProfile && !profileExists) {
    issues.push(`hasProfile: true ですがプロフィール設定 ${id}.profile.json がありません（作るか hasProfile を false に）`);
  }
  return issues;
}

/**
 * 止めない警告: hasProfile: false なのにプロフィール設定がある（生成されず、使われない）
 * @returns {string[]}
 */
export function roleWarnings({ role, profileExists }) {
  if (role?.hasProfile === false && profileExists) {
    return [`hasProfile: false ですがプロフィール設定 ${role.id}.profile.json があります（生成し直さず、今ある生成物は残します。使うなら hasProfile を true に、使わないなら pnpm generate role -- --delete-profile で消す）`];
  }
  return [];
}
