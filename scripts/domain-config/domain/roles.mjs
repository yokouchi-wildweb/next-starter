// ロール定義（src/features/core/user/roles/*.role.json）の読み出し。ファイル用途のアップロード権限の判定に使う

/**
 * ロール ID → カテゴリ（"admin" | "user"）。読めないロール定義は role:generate 側で検出されるので無視する
 * @param {import("./workspace.mjs").Workspace} workspace
 * @returns {Map<string, string>}
 */
export function loadRoleCategories(workspace) {
  const categories = new Map();
  for (const name of workspace.listDir(workspace.rolesDir)) {
    if (!name.endsWith(".role.json")) continue;
    try {
      const json = JSON.parse(workspace.readText(`${workspace.rolesDir}/${name}`));
      if (json.id) categories.set(json.id, json.category ?? "user");
    } catch {
      // 読めないロール定義は role:generate 側で検出される
    }
  }
  return categories;
}
