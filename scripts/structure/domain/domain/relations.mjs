// 登録の entity.json の relations の分類と、リレーション先ドメインの参照。

import { junctionColumnsOf, registrationTableName } from "../../../../src/lib/domain/node.mjs";
import { toCamelCase, toPascalCase, toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";

/** belongsTo（外部キーを持つ側） */
export function belongsToRelations(config) {
  return (config?.relations || []).filter((rel) => rel.relationType === "belongsTo");
}

/** belongsToMany のうち結びの登録を持つ側(through を書いた関係、D354)。through の無い関係は相手の結びを読むだけの参照 */
export function belongsToManyRelations(config) {
  return (config?.relations || []).filter((rel) => rel.relationType === "belongsToMany" && rel.through !== undefined);
}

/**
 * 関係の結びの登録(through)の表と、持つ側・相手を指す列の TS 名(結びの登録の belongsTo の fieldName、手の表の形なら foreignKeys の列)
 * @param {import("./workspace.mjs").Workspace} workspace
 * @param {string} owner 持つ側の登録名(camelCase)
 * @param {object} relation through を書いた belongsToMany
 * @returns {{ registration: string, tableVar: string, sourceProperty: string, targetProperty: string }}
 */
export function junctionOf(workspace, owner, relation) {
  const registration = toCamelCase(relation.through);
  const config = workspace.readRegistration(registration);
  if (!config) throw new Error(`エラー: ${owner} の belongsToMany "${relation.domain}" の through ${relation.through} の登録(entities/${registration}/entity.json)がありません`);
  const target = toCamelCase(relation.domain);
  const registrationOfTable = (table) => [owner, target].find((name) => domainTableNameOf(workspace, name) === table) ?? null;
  const columns = junctionColumnsOf(config, owner, target, registrationOfTable);
  if (!columns) throw new Error(`エラー: 結びの登録 ${registration} が ${owner} と ${target} を指す 2 本を持ちません(pnpm check domain)`);
  return { registration, tableVar: `${toPascalCase(registration)}Table`, sourceProperty: columns.sourceColumn, targetProperty: columns.targetColumn };
}

/**
 * 多対多の結びの登録か(どこかの登録の belongsToMany が through で名指している、D354)
 * @param {import("./workspace.mjs").Workspace} workspace
 * @param {string} name 登録名(camelCase)
 */
export function isJunctionRegistration(workspace, name) {
  return workspace.listDomains().some((domain) =>
    workspace.registrationsOf(domain).some(({ config }) => belongsToManyRelations(config).some((relation) => toCamelCase(relation.through) === name)),
  );
}

/** 登録の物理の表の名前(src/lib/domain/junction/links.mjs の registrationTableName。宣言が無ければ null) */
function domainTableNameOf(workspace, name) {
  const config = workspace.readRegistration(name);
  return config ? registrationTableName(name, config) : null;
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
