// domain.json の relations の分類と、リレーション先ドメインの参照。

import { toCamelCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";

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
 * リレーション先ドメインの表名。domain.json があれば plural、無ければ snake_case 化。
 * features/ と features/core/ の両方を探し、最初に見つかった domain.json だけを見る（壊れていれば snake_case）
 */
export function foreignTableName(workspace, domainName) {
  const domainCamel = toCamelCase(domainName) || domainName;
  const candidates = [workspace.featurePath(domainCamel, "domain.json"), workspace.featurePath("core", domainCamel, "domain.json")];
  for (const configPath of candidates) {
    if (workspace.exists(configPath)) {
      const foreignConfig = workspace.readConfigLenient(configPath);
      if (foreignConfig?.plural) {
        return toSnakeCase(foreignConfig.plural);
      }
      break;
    }
  }
  return toSnakeCase(domainName);
}
