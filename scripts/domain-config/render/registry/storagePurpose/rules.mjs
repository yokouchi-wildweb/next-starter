// ファイル用途（storagePurposeRegistry）の権限の規則: 汎用 API の規則の解決、アップロード許可者の和、一般利用者の判定、直列化

export const ADMIN_RULE = { roleCategories: ["admin"] };
const READ_OPERATIONS = new Set(["list", "get", "search", "count"]);

export function isValidRule(rule) {
  if (rule === "public" || rule === "authenticated" || rule === "none") return true;
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
  const okList = (v) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === "string"));
  return okList(rule.roles) && okList(rule.roleCategories) && (rule.roles !== undefined || rule.roleCategories !== undefined);
}

/** 汎用 API と同じ解決順: operations[op] → read / write → 既定（管理者のみ） */
export function resolveOperationRule(apiAccess, operation) {
  if (!apiAccess) return ADMIN_RULE;
  const opRule = apiAccess.operations?.[operation];
  if (isValidRule(opRule)) return opRule;
  const groupRule = READ_OPERATIONS.has(operation) ? apiAccess.read : apiAccess.write;
  if (isValidRule(groupRule)) return groupRule;
  return ADMIN_RULE;
}

/**
 * アップロードの許可者 = 複数の規則の和。アップロードは常にログインが要るので public は authenticated にする。
 * none は数えない。全部 none なら管理者のみ（fail-closed）
 */
export function unionUploadRules(rules) {
  const effective = rules.filter((rule) => rule && rule !== "none");
  if (effective.length === 0) return ADMIN_RULE;
  if (effective.some((rule) => rule === "public" || rule === "authenticated")) return "authenticated";
  const roles = new Set();
  const roleCategories = new Set();
  for (const rule of effective) {
    (rule.roles ?? []).forEach((r) => roles.add(r));
    (rule.roleCategories ?? []).forEach((c) => roleCategories.add(c));
  }
  const result = {};
  if (roles.size > 0) result.roles = [...roles];
  if (roleCategories.size > 0) result.roleCategories = [...roleCategories];
  return result;
}

/** 一般利用者（admin 以外のカテゴリ）が通る規則か。カテゴリの分からないロールは一般利用者として扱う（安全側） */
export function allowsGeneralUser(rule, roleCategories) {
  if (rule === "public" || rule === "authenticated") return true;
  if (!rule || typeof rule !== "object") return false;
  if ((rule.roleCategories ?? []).some((category) => category !== "admin")) return true;
  return (rule.roles ?? []).some((role) => (roleCategories.get(role) ?? "user") !== "admin");
}

export function serializeRule(rule) {
  if (typeof rule === "string") return JSON.stringify(rule);
  const parts = [];
  if (rule.roles) parts.push(`roles: ${JSON.stringify(rule.roles).replace(/,/g, ", ")}`);
  if (rule.roleCategories) parts.push(`roleCategories: ${JSON.stringify(rule.roleCategories).replace(/,/g, ", ")}`);
  return `{ ${parts.join(", ")} }`;
}

export function serializeStringArray(values) {
  return `[${values.map((v) => JSON.stringify(v)).join(", ")}]`;
}
