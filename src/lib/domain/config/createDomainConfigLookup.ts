// src/lib/domain/config/createDomainConfigLookup.ts
// ドメイン設定の表を受けて、ドメイン名から設定を引く関数を作る。
// lib は登録表を import しない。表と結んだ版は src/wiring/domainConfig.ts(server 専用)。

import { toCamelCase, toSnakeCase } from "@/utils/stringCase.mjs";

/**
 * Firestore ドメインの場合、フィールド名を camelCase に変換して返す。
 * domain.json は常に snake_case だが、Firestore の慣例は camelCase のため
 * ランタイムで変換する。
 */
function normalizeFieldNames<TConfig>(config: TConfig): TConfig {
  const raw = config as Record<string, any>;
  if (raw.dbEngine !== "Firestore") return config;

  const resolveField = (name: string) => toCamelCase(name) || name;

  const result = { ...raw };

  if (Array.isArray(raw.fields)) {
    result.fields = raw.fields.map((f: Record<string, unknown>) => ({
      ...f,
      name: resolveField(f.name as string),
    }));
  }

  if (Array.isArray(raw.tableFields)) {
    result.tableFields = raw.tableFields.map((f: string) => resolveField(f));
  }

  if (Array.isArray(raw.searchFields)) {
    result.searchFields = raw.searchFields.map((f: string) => resolveField(f));
  }

  if (Array.isArray(raw.defaultOrderBy)) {
    result.defaultOrderBy = raw.defaultOrderBy.map((item: unknown) => {
      if (Array.isArray(item)) {
        return [resolveField(item[0] as string), ...item.slice(1)];
      }
      return resolveField(item as string);
    });
  }

  return result as TConfig;
}

/** 表（キー = ドメイン名の snake_case）から getDomainConfig / hasDomainConfig を作る */
export function createDomainConfigLookup<TConfig>(configMap: Readonly<Record<string, TConfig>>) {
  const normalizeDomainKey = (domain: string): string | undefined => {
    const snake = toSnakeCase(domain);
    if (snake && snake in configMap) return snake;
    return domain in configMap ? domain : undefined;
  };

  // Firestore ドメインの変換結果をキャッシュ
  const normalizedConfigCache = new Map<string, TConfig>();

  return {
    getDomainConfig(domain: string): TConfig {
      const key = normalizeDomainKey(domain);
      if (!key) {
        throw new Error(`Domain config not found: ${domain}`);
      }
      const cached = normalizedConfigCache.get(key);
      if (cached) return cached;
      const config = normalizeFieldNames(configMap[key]);
      normalizedConfigCache.set(key, config);
      return config;
    },
    /** ドメイン設定が存在するかどうかを判定 */
    hasDomainConfig(domain: string): boolean {
      return normalizeDomainKey(domain) !== undefined;
    },
  };
}
