// src/lib/domain/config/getDomainConfig.ts
// ドメイン設定 (domain.json) を取得するユーティリティ。

import { domainConfigMap, type DomainConfig, type DomainKey } from "@/registry/domainConfigRegistry";
import { toSnakeCase } from "@/utils/stringCase.mjs";

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

export function getDomainConfig(domain: string): DomainConfig {
  const key = normalizeDomainKey(domain);
  if (!key) {
    throw new Error(`Domain config not found: ${domain}`);
  }
  return domainConfigMap[key];
}

/**
 * ドメイン設定が存在するかどうかを判定
 */
export function hasDomainConfig(domain: string): boolean {
  return normalizeDomainKey(domain) !== undefined;
}
