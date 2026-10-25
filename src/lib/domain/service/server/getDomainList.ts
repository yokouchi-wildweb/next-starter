// src/lib/domain/service/server/getDomainList.ts
// 登録表から「全件削除できるドメイン」の一覧を作る汎用関数（登録表・domain.json の一覧は引数で受ける）。
// 管理者の全件削除画面（/admin/insane/truncate）が使う。access の評価は呼び手（API ルート）が行う。

import "server-only";

import type { DomainInfo, DomainInfoWithCount, DomainRegistry, DomainService } from "../../types";

export type { DomainInfo, DomainInfoWithCount };

/** domain.json の一覧のうち、この関数が読む部分（キーは snake_case） */
export type DomainLabelMap = Readonly<Record<string, { label?: string }>>;

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
  service: DomainService | undefined,
): service is DomainService & { truncateAll: () => Promise<string[]>; getTableName: () => string } {
  return (
    typeof service === "object" &&
    service !== null &&
    typeof service.truncateAll === "function" &&
    typeof service.getTableName === "function"
  );
}

/** 読み込めないエントリは一覧に出さず、キーは throw しない（全件削除の一覧が 1 件の不良で全滅しないため） */
async function loadService(registry: DomainRegistry, key: string): Promise<DomainService | undefined> {
  try {
    return await registry[key].service();
  } catch {
    return undefined;
  }
}

/**
 * 登録表からドメイン一覧を取得する（truncateAll 対応のドメインのみ）
 *
 * @param registry serviceRegistry
 * @param configMap domainConfigMap（label の参照用。無いキーは core 扱い）
 */
export async function getDomainList(registry: DomainRegistry, configMap: DomainLabelMap): Promise<DomainInfo[]> {
  const domains: DomainInfo[] = [];

  for (const key of Object.keys(registry)) {
    const service = await loadService(registry, key);
    // truncateAll対応のサービスのみ対象
    if (!hasTruncateAll(service)) {
      continue;
    }

    // domainConfigMapのキーはsnake_case、serviceRegistryのキーはcamelCase
    const configKey = Object.keys(configMap).find((k) => snakeToCamel(k) === key);
    const config = configKey ? configMap[configKey] : undefined;

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
 * ドメイン一覧にレコード数を付ける（search が無い・例外なら 0）
 */
export async function withRecordCounts(
  registry: DomainRegistry,
  domains: readonly DomainInfo[],
): Promise<DomainInfoWithCount[]> {
  // 全ドメインのレコード数取得を並列実行（同時実行数制限付き）
  const CONCURRENCY = 5;
  const counts = new Array<number>(domains.length).fill(0);

  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const chunk = domains.slice(i, i + CONCURRENCY);
    const chunkCounts = await Promise.all(
      chunk.map(async (domain) => {
        const service = await loadService(registry, domain.key);
        if (typeof service?.search !== "function") return 0;
        try {
          const result = (await service.search({ limit: 1 })) as { total?: number };
          return result.total ?? 0;
        } catch {
          return 0;
        }
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
 * 登録表からドメイン一覧を取得する（レコード数付き）
 */
export async function getDomainListWithCount(
  registry: DomainRegistry,
  configMap: DomainLabelMap,
): Promise<DomainInfoWithCount[]> {
  return withRecordCounts(registry, await getDomainList(registry, configMap));
}

/**
 * 指定されたドメインキーが全件削除できるか（登録済みかつ truncateAll 対応）
 */
export async function isValidDomainKey(registry: DomainRegistry, key: string): Promise<boolean> {
  if (!Object.prototype.hasOwnProperty.call(registry, key)) return false;
  return hasTruncateAll(await loadService(registry, key));
}

/**
 * 複数のドメインキーを検証し、無効なキーを返す
 */
export async function getInvalidDomainKeys(registry: DomainRegistry, keys: readonly string[]): Promise<string[]> {
  const invalid: string[] = [];
  for (const key of keys) {
    if (!(await isValidDomainKey(registry, key))) invalid.push(key);
  }
  return invalid;
}
