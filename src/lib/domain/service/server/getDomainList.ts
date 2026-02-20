// src/lib/domain/service/server/getDomainList.ts

import "server-only";
import { serviceRegistry } from "@/registry/serviceRegistry";
import { domainConfigMap } from "@/registry/domainConfigRegistry";
import type { DomainInfo, DomainInfoWithCount } from "../../types";

export type { DomainInfo, DomainInfoWithCount };

/**
 * snake_case を camelCase に変換
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * サービスがtruncateAll対応かどうかを判定
 */
function hasTruncateAll(
  service: unknown
): service is { truncateAll: () => Promise<string[]>; getTableName: () => string } {
  return (
    typeof service === "object" &&
    service !== null &&
    "truncateAll" in service &&
    typeof (service as Record<string, unknown>).truncateAll === "function" &&
    "getTableName" in service &&
    typeof (service as Record<string, unknown>).getTableName === "function"
  );
}

/**
 * サービスがsearch対応かどうかを判定
 */
function hasSearch(
  service: unknown
): service is { search: (params: { limit: number }) => Promise<{ total: number }> } {
  return (
    typeof service === "object" &&
    service !== null &&
    "search" in service &&
    typeof (service as Record<string, unknown>).search === "function"
  );
}

/**
 * serviceRegistryからドメイン一覧を取得する
 * truncateAll対応のドメインのみを返す
 */
export function getDomainList(): DomainInfo[] {
  const domains: DomainInfo[] = [];

  for (const [key, service] of Object.entries(serviceRegistry)) {
    // truncateAll対応のサービスのみ対象
    if (!hasTruncateAll(service)) {
      continue;
    }

    // domainConfigMapのキーはsnake_case、serviceRegistryのキーはcamelCase
    // domainConfigMapから対応する設定を探す
    const configKey = Object.keys(domainConfigMap).find(
      (k) => snakeToCamel(k) === key
    );
    const config = configKey
      ? (domainConfigMap as Record<string, { label?: string }>)[configKey]
      : undefined;

    // domainConfigMapに存在しない = コアドメイン
    const isCore = !configKey;
    const label = config?.label ?? key;
    const tableName = service.getTableName();

    domains.push({
      key,
      label,
      tableName,
      isCore,
    });
  }

  // コアドメインを先に、その後ビジネスドメインをアルファベット順
  return domains.sort((a, b) => {
    if (a.isCore !== b.isCore) {
      return a.isCore ? -1 : 1;
    }
    return a.key.localeCompare(b.key);
  });
}

/**
 * serviceRegistryからドメイン一覧を取得する（レコード数付き）
 * truncateAll対応のドメインのみを返す
 */
export async function getDomainListWithCount(): Promise<DomainInfoWithCount[]> {
  const domains = getDomainList();

  // 全ドメインのレコード数取得を並列実行（同時実行数制限付き）
  const CONCURRENCY = 5;
  const counts = new Array<number>(domains.length).fill(0);

  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const chunk = domains.slice(i, i + CONCURRENCY);
    const chunkCounts = await Promise.all(
      chunk.map(async (domain) => {
        const service = serviceRegistry[domain.key];
        if (hasSearch(service)) {
          try {
            const result = await service.search({ limit: 1 });
            return result.total;
          } catch {
            return 0;
          }
        }
        return 0;
      }),
    );
    chunkCounts.forEach((count, j) => {
      counts[i + j] = count;
    });
  }

  return domains.map((domain, i) => ({
    ...domain,
    recordCount: counts[i]!,
  }));
}

/**
 * 指定されたドメインキーが有効かどうかを検証
 */
export function isValidDomainKey(key: string): boolean {
  const service = serviceRegistry[key];
  return hasTruncateAll(service);
}

/**
 * 複数のドメインキーを検証し、無効なキーを返す
 */
export function getInvalidDomainKeys(keys: string[]): string[] {
  return keys.filter((key) => !isValidDomainKey(key));
}
