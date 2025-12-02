// src/features/core/domainConfig/getDomainConfig.ts
// ドメイン設定 (domain.json) を取得するユーティリティ。

import sampleConfig from "@/features/sample/domain.json";
import sampleCategoryConfig from "@/features/sampleCategory/domain.json";
import sampleTagConfig from "@/features/sampleTag/domain.json";
import { toSnakeCase } from "@/utils/stringCase.mjs";

const domainConfigMap = {
  sample: sampleConfig,
  sample_category: sampleCategoryConfig,
  sample_tag: sampleTagConfig,
} as const;

export type DomainKey = keyof typeof domainConfigMap;
export type DomainConfig = (typeof domainConfigMap)[DomainKey];

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
