// scripts/role-config/generator/header.mjs
// role:generate の生成物の 1 行目（extensions の一覧と同じ印「// 生成物・編集不可: 」で始める）

/** @param {string} source 元のファイル（リポジトリ直下からの相対） */
export const generatedHeader = (source) => `// 生成物・編集不可: pnpm role:generate が ${source} から生成する`;

/** プロフィールごとの生成物の 1 行目 */
export const profileFileHeader = (roleId) => generatedHeader(`src/features/core/userProfile/profiles/${roleId}.profile.json`);
