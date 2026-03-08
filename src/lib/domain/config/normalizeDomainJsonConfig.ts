// src/lib/domain/config/normalizeDomainJsonConfig.ts
// domain.json の直接インポート時に Firestore ドメインのフィールド名を camelCase に変換する。
// クライアント/サーバー両方で使用可能な軽量ユーティリティ。

import { toCamelCase } from "@/utils/stringCase.mjs";

type RawDomainConfig = Record<string, unknown>;

const resolveField = (name: string) => toCamelCase(name) || name;

/**
 * domain.json を直接インポートした際に、Firestore ドメインのフィールド名を camelCase に正規化する。
 * Drizzle/Neon ドメインの場合はそのまま返す（no-op）。
 *
 * @example
 * import rawConfig from "@/features/chatRoom/domain.json";
 * const domainConfig = normalizeDomainJsonConfig(rawConfig);
 */
export function normalizeDomainJsonConfig<T extends RawDomainConfig>(config: T): T {
  if (config.dbEngine !== "Firestore") return config;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
