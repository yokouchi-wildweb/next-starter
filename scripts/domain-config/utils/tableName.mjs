// ドメインの表の物理名の決め方（domain.json に表名の項目は無いので、生成器はこの式で決める）。
// 表の定義（generator/entities/generate-drizzle-entity.mjs）と登録（generator/registry/writeDomainEntry.mjs の table）が
// 同じ値になるよう、両方がこの関数を使う。

import { toSnakeCase } from "../../../src/utils/stringCase.mjs";

/**
 * 表の物理名 = domain.json の plural（無ければドメイン名）の snake_case
 * @param {string} domain ドメイン名（camelCase / snake_case のどちらでも）
 * @param {{ plural?: string } | null | undefined} config domain.json
 */
export function domainTableName(domain, config) {
  const normalized = toSnakeCase(domain) || domain;
  return toSnakeCase(config?.plural || normalized);
}
