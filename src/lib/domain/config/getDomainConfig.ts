// src/lib/domain/config/getDomainConfig.ts
// ドメイン設定 (domain.json) を取得するユーティリティ。

import { domainConfigMap, type DomainConfig, type DomainKey } from "@/registry/domainConfigRegistry";
import { toCamelCase, toSnakeCase } from "@/utils/stringCase.mjs";

export type { DomainConfig };

const normalizeDomainKey = (domain: string) => {
  const snake = toSnakeCase(domain);
  if (snake && snake in domainConfigMap) {
    return snake as DomainKey;
  }
  if (domain in domainConfigMap) {
    return domain as DomainKey;
  }
  return undefined;
};

/**
 * Firestore ドメインの場合、フィールド名を camelCase に変換して返す。
 * domain.json は常に snake_case だが、Firestore の慣例は camelCase のため
 * ランタイムで変換する。
 */
function normalizeFieldNames(config: DomainConfig): DomainConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return result as DomainConfig;
}

// Firestore ドメインの変換結果をキャッシュ
const normalizedConfigCache = new Map<DomainKey, DomainConfig>();

export function getDomainConfig(domain: string): DomainConfig {
  const key = normalizeDomainKey(domain);
  if (!key) {
    throw new Error(`Domain config not found: ${domain}`);
  }
  const cached = normalizedConfigCache.get(key);
  if (cached) return cached;
  const config = normalizeFieldNames(domainConfigMap[key]);
  normalizedConfigCache.set(key, config);
  return config;
}

/**
 * ドメイン設定が存在するかどうかを判定
 */
export function hasDomainConfig(domain: string): boolean {
  return normalizeDomainKey(domain) !== undefined;
}
