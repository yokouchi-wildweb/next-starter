// DB の識別子の決め方（表名・FK 名・enum 名）と PostgreSQL の 63 字制限。
// 表の定義（render/entities/drizzle）と登録（render/registry/domainEntry の table）が同じ値になるよう、両方がここを使う。

import { toPascalCase, toSnakeCase } from "../../../src/utils/stringCase.mjs";

/** PostgreSQL の識別子の最大長 */
export const PG_MAX_IDENTIFIER_LENGTH = 63;

/**
 * 表の物理名 = domain.json の plural（無ければドメイン名）の snake_case
 * @param {string} domain ドメイン名（camelCase / snake_case のどちらでも）
 * @param {{ plural?: string } | null | undefined} config domain.json
 */
export function domainTableName(domain, config) {
  const normalized = toSnakeCase(domain) || domain;
  return toSnakeCase(config?.plural || normalized);
}

/** Drizzle が自動生成する FK 制約名: {table}_{column}_{foreignTable}_{foreignColumn}_fk */
export function computeFkName(sourceTable, columnName, foreignTable, foreignColumn = "id") {
  return `${sourceTable}_${columnName}_${foreignTable}_${foreignColumn}_fk`;
}

/** 短縮 FK 制約名（外部テーブル名を省略）: {table}_{column}_fk */
export function buildShortFkName(sourceTable, columnName) {
  return `${sourceTable}_${columnName}_fk`;
}

/** 自動生成の FK 制約名が 63 字を超えるか */
export function isFkNameTooLong(sourceTable, columnName, foreignTable, foreignColumn = "id") {
  return computeFkName(sourceTable, columnName, foreignTable, foreignColumn).length > PG_MAX_IDENTIFIER_LENGTH;
}

/**
 * enum 項目の定数名と DB の enum 名。項目名がドメイン名で始まっていればその分を除き、末尾の Field も落とす
 * @returns {{ constName: string, enumName: string }} 例: { constName: "SampleKindEnum", enumName: "sample_kind_enum" }
 */
export function enumNames(camel, pascal, fieldName) {
  const domainPrefix = camel.toLowerCase();
  let base = fieldName;
  if (base.toLowerCase().startsWith(domainPrefix)) {
    base = base.slice(domainPrefix.length);
  }
  base = toPascalCase(base).replace(/Field$/, "");
  return { constName: `${pascal}${base}Enum`, enumName: `${camel}_${toSnakeCase(base)}_enum` };
}
