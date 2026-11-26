// domain.json の relations の分類と、リレーション先ドメインの参照。

import { toCamelCase, toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";

/** belongsTo（外部キーを持つ側） */
export function belongsToRelations(config) {
  return (config?.relations || []).filter((rel) => rel.relationType === "belongsTo");
}

/** belongsToMany のうち中間テーブルを自分が持つもの（includeRelationTable !== false） */
export function belongsToManyRelations(config) {
  return (config?.relations || []).filter(
    (rel) => rel.relationType === "belongsToMany" && rel.includeRelationTable !== false,
  );
}

/** hasMany（子の表が自分を参照する） */
export function hasManyRelations(config) {
  return (config?.relations || []).filter((rel) => rel.relationType === "hasMany");
}

/**
 * belongsTo の onDelete 挙動（旧形式 onDeleteCascade: true も読む）
 * @returns {"CASCADE" | "RESTRICT" | "SET_NULL"}
 */
export function getOnDeleteBehavior(relation) {
  if (relation.onDelete) {
    return relation.onDelete;
  }
  if (relation.onDeleteCascade === true) {
    return "CASCADE";
  }
  return "RESTRICT";
}

/** onDelete 挙動 → Drizzle の .references() 第 2 引数 */
export function buildOnDeleteOption(behavior) {
  switch (behavior) {
    case "CASCADE":
      return ', { onDelete: "cascade" }';
    case "SET_NULL":
      return ', { onDelete: "set null" }';
    case "RESTRICT":
      return ', { onDelete: "restrict" }';
    default:
      return "";
  }
}

/**
 * リレーション先の表名。関連の先(relations[].domain = 登録名)の entity.json の table、無ければ plural の snake_case、
 * 宣言が無ければ名前の snake_case(読み込みは workspace.readRegistration = 宣言の読み込みの部品)
 */
export function foreignTableName(workspace, domainName) {
  const domainCamel = toCamelCase(domainName) || domainName;
  const foreign = workspace.readRegistration?.(domainCamel) ?? null;
  if (typeof foreign?.table === "string") return foreign.table;
  if (foreign?.plural) return toSnakeCase(foreign.plural);
  return toSnakeCase(domainName);
}
