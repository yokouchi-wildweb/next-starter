// 検査: ロール設定（<id>.role.json）の形と、プロフィール設定（<id>.profile.json）との対応。
// 生成器は JSON を読むだけで、ID の形・ファイル名・category・hasProfile を誰も確かめていなかった（対話の質問の中にだけあった）。
// isCore とファイル名の _ がずれると roleRegistry.ts の import が壊れ、hasProfile とプロフィール設定がずれると黙って生成を飛ばすので止める。
// 規則の正: src/features/core/user/README.md（ロール設定）、src/features/core/userProfile/README.md（プロフィール設定）

/** ロール ID の形（列名・変数名・パスに使う） */
const ROLE_ID = /^[a-z][a-z0-9_]*$/;
const CATEGORIES = new Set(["user", "admin"]);

/** ロール設定のファイル名（コアロールは _ を付ける。updateRoleRegistry.mjs と同じ） */
export const roleFileName = (id, isCore) => `${isCore ? "_" : ""}${id}.role.json`;

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
    if (role.isCore !== undefined && typeof role.isCore !== "boolean") issues.push(`isCore は true か false にしてください`);
    const expected = roleFileName(id, role.isCore === true);
    if (fileName !== expected) {
      issues.push(
        `ファイル名 ${fileName} は ${expected} にしてください（` +
          (role.isCore === true ? "isCore: true のロールは _ を付ける" : "_ を付けるのは isCore: true のロールだけ") +
          "。roleRegistry.ts の import がこの名前を使います）",
      );
    }
  }
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
    return [`hasProfile: false ですがプロフィール設定 ${role.id}.profile.json があります（生成し直さず、今ある生成物は残します。使うなら hasProfile を true に、使わないなら prof:delete で消す）`];
  }
  return [];
}
