// アクセスルール（"public" / "authenticated" / "none" / { roles, roleCategories }）の広さの比べ方。組の権限の検査が使う。
// 広さ: public ⊇ authenticated ⊇ ロールの規則 ⊇ none。ロールの規則どうしは、ロールをそのカテゴリ（role.json）に解いて比べる

const ROLE_RULE_FIELDS = ["roles", "roleCategories"];

const isRoleRule = (rule) => Boolean(rule) && typeof rule === "object" && ROLE_RULE_FIELDS.some((key) => Array.isArray(rule[key]));

/**
 * broad が narrow の通す人をすべて通すか
 * @param {unknown} broad
 * @param {unknown} narrow
 * @param {Map<string, string>} roleCategories ロール ID → カテゴリ（domain/roles.mjs の loadRoleCategories。知らないロールは user）
 */
export function ruleCovers(broad, narrow, roleCategories = new Map()) {
  if (narrow === "none" || broad === "public") return true;
  if (narrow === "public") return false;
  if (broad === "authenticated") return true; // narrow は authenticated かロールの規則
  if (narrow === "authenticated" || !isRoleRule(narrow) || !isRoleRule(broad)) return false;
  const roles = new Set(broad.roles ?? []);
  const categories = new Set(broad.roleCategories ?? []);
  const roleCovered = (role) => roles.has(role) || categories.has(roleCategories.get(role) ?? "user");
  return (narrow.roles ?? []).every(roleCovered) && (narrow.roleCategories ?? []).every((category) => categories.has(category));
}

/** a が b より狭い（b が通す人のうち a が通さない人がいる） */
export const isNarrower = (a, b, roleCategories) => !ruleCovers(a, b, roleCategories);

/** a が b より広い（a が通す人のうち b が通さない人がいる） */
export const isBroader = (a, b, roleCategories) => !ruleCovers(b, a, roleCategories);

/** メッセージ用の規則の表記 */
export const describeRule = (rule) => (typeof rule === "string" ? `"${rule}"` : JSON.stringify(rule));
