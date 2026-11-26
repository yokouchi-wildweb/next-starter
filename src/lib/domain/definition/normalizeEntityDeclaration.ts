// src/lib/domain/definition/normalizeEntityDeclaration.ts
// 登録の宣言 entities/<登録名>/entity.json の直接インポート時に Firestore の登録のフィールド名を camelCase に変換する。
// server が自分のドメインの登録の宣言を読むときに使う。client は変換済みの写し entities/display.ts を読む。

import { toCamelCase } from "@/lib/stringCase/index.mjs";

type RawDomainConfig = Record<string, unknown>;

const resolveField = (name: string) => toCamelCase(name) || name;

/**
 * 登録の宣言 entity.json を直接インポートした際に、Firestore の登録のフィールド名を camelCase に正規化する。
 * Drizzle/Neon の登録の場合はそのまま返す（no-op）。
 *
 * @example
 * import rawConfig from "@/domains/core/chatRoom/entities/chatRoom/entity.json";
 * const domainConfig = normalizeEntityDeclaration(rawConfig);
 */
export function normalizeEntityDeclaration<T extends RawDomainConfig>(config: T): T {
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
