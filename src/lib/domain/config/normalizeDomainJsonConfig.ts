// src/lib/domain/config/normalizeDomainJsonConfig.ts
// domain.json の直接インポート時に Firestore ドメインのフィールド名を camelCase に変換する。
// server が自分のドメインの domain.json を読むときに使う。client は変換済みの写し entities/display.ts を読む。

import { toCamelCase } from "@/utils/stringCase.mjs";

type RawDomainConfig = Record<string, unknown>;

const resolveField = (name: string) => toCamelCase(name) || name;

/**
 * domain.json を直接インポートした際に、Firestore ドメインのフィールド名を camelCase に正規化する。
 * Drizzle/Neon ドメインの場合はそのまま返す（no-op）。
 *
 * @example
 * import rawConfig from "@/features/core/chatRoom/domain.json";
 * const domainConfig = normalizeDomainJsonConfig(rawConfig);
 */
export function normalizeDomainJsonConfig<T extends RawDomainConfig>(config: T): T {
  if (config.dbEngine !== "Firestore") return config;

  const result: Record<string, any> = { ...config };

  if (Array.isArray(result.fields)) {
    result.fields = result.fields.map((f: Record<string, unknown>) => ({
      ...f,
      name: resolveField(f.name as string),
    }));
  }

  if (Array.isArray(result.tableFields)) {
    result.tableFields = result.tableFields.map((f: string) => resolveField(f));
  }

  if (Array.isArray(result.searchFields)) {
    result.searchFields = result.searchFields.map((f: string) => resolveField(f));
  }

  if (Array.isArray(result.defaultOrderBy)) {
    result.defaultOrderBy = result.defaultOrderBy.map((item: unknown) => {
      if (Array.isArray(item)) {
        return [resolveField(item[0] as string), ...item.slice(1)];
      }
      return resolveField(item as string);
    });
  }

  if (Array.isArray(result.relations)) {
    result.relations = result.relations.map((rel: Record<string, unknown>) => ({
      ...rel,
      fieldName: resolveField(rel.fieldName as string),
    }));
  }

  return result as T;
}
