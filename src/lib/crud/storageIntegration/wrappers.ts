// src/lib/crud/storageIntegration/wrappers.ts

import { getDomainConfig } from "@/lib/domain";
import { extractStorageFields, extractStorageFieldsWithPath } from "./extractStorageFields";
import { cleanupStorageFiles } from "./cleanupFiles";
import { duplicateStorageFiles } from "./duplicateFiles";

type BaseService = {
  get: (id: string) => Promise<Record<string, unknown> | undefined>;
  create: (data: any) => Promise<Record<string, unknown>>;
  remove: (id: string) => Promise<void>;
  duplicate?: (id: string) => Promise<Record<string, unknown>>;
  bulkDeleteByIds?: (ids: string[]) => Promise<void>;
  hardDelete?: (id: string) => Promise<void>;
  bulkDeleteByQuery?: (where: any) => Promise<void>;
  search?: (params: any) => Promise<{ results: Record<string, unknown>[] }>;
};

/**
 * ストレージ連携対応のremoveを作成
 *
 * @example
 * // wrappers/remove.ts
 * import { createStorageAwareRemove } from "@/lib/crud/storageIntegration";
 * import { base } from "../drizzleBase";
 * export const remove = createStorageAwareRemove(base, "sample");
 */
export function createStorageAwareRemove<T extends BaseService>(
  base: T,
  domainKey: string
): (id: string) => Promise<void> {
  const storageFields = extractStorageFields(getDomainConfig(domainKey));

  return async (id: string): Promise<void> => {
    if (storageFields.length) {
      const record = await base.get(id);
      if (record) {
        await cleanupStorageFiles(record, storageFields);
      }
    }
    await base.remove(id);
  };
}

/**
 * ストレージ連携対応のbulkDeleteByIdsを作成
 *
 * @example
 * // wrappers/bulkDeleteByIds.ts
 * import { createStorageAwareBulkDeleteByIds } from "@/lib/crud/storageIntegration";
 * import { base } from "../drizzleBase";
 * export const bulkDeleteByIds = createStorageAwareBulkDeleteByIds(base, "sample");
 */
export function createStorageAwareBulkDeleteByIds<T extends BaseService>(
  base: T,
  domainKey: string
): (ids: string[]) => Promise<void> {
  const storageFields = extractStorageFields(getDomainConfig(domainKey));

  return async (ids: string[]): Promise<void> => {
    if (storageFields.length && ids.length) {
      // 1クエリで全レコードを取得（bulkDeleteByQuery と同じパターン）
      let records: Record<string, unknown>[] = [];
      if (base.search) {
        const result = await base.search({ where: { field: "id", op: "in", value: ids }, limit: ids.length });
        records = result.results;
      } else {
        // search が未定義の場合はフォールバック
        const fetched = await Promise.all(ids.map((id) => base.get(id)));
        records = fetched.filter((r): r is Record<string, unknown> => r !== undefined);
      }
      await Promise.all(records.map((r) => cleanupStorageFiles(r, storageFields)));
    }
    await base.bulkDeleteByIds?.(ids);
  };
}

/**
 * ストレージ連携対応のduplicateを作成
 *
 * @example
 * // wrappers/duplicate.ts
 * import { createStorageAwareDuplicate } from "@/lib/crud/storageIntegration";
 * import { base } from "../drizzleBase";
 * export const duplicate = createStorageAwareDuplicate(base, "sample");
 */
export function createStorageAwareDuplicate<T extends BaseService>(
  base: T,
  domainKey: string
): (id: string) => Promise<Record<string, unknown>> {
  const storageFieldsInfo = extractStorageFieldsWithPath(getDomainConfig(domainKey));

  return async (id: string): Promise<Record<string, unknown>> => {
    const record = await base.get(id);
    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }

    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...rest
    } = record;

    let newData: Record<string, unknown> = { ...rest };

    // nameフィールドがあれば「_コピー」を追加
    if (typeof newData.name === "string") {
      newData.name = `${newData.name}_コピー`;
    }

    if (storageFieldsInfo.length) {
      const newUrls = await duplicateStorageFiles(record, storageFieldsInfo);
      newData = { ...newData, ...newUrls };
    }

    return base.create(newData);
  };
}

/**
 * ストレージ連携対応のhardDeleteを作成
 *
 * @example
 * // wrappers/hardDelete.ts
 * import { createStorageAwareHardDelete } from "@/lib/crud/storageIntegration";
 * import { base } from "../drizzleBase";
 * export const hardDelete = createStorageAwareHardDelete(base, "sample");
 */
export function createStorageAwareHardDelete<T extends BaseService>(
  base: T,
  domainKey: string
): (id: string) => Promise<void> {
  const storageFields = extractStorageFields(getDomainConfig(domainKey));

  return async (id: string): Promise<void> => {
    if (storageFields.length) {
      const record = await base.get(id);
      if (record) {
        await cleanupStorageFiles(record, storageFields);
      }
    }
    await base.hardDelete?.(id);
  };
}

/**
 * ストレージ連携対応のbulkDeleteByQueryを作成
 *
 * @example
 * // wrappers/bulkDeleteByQuery.ts
 * import { createStorageAwareBulkDeleteByQuery } from "@/lib/crud/storageIntegration";
 * import { base } from "../drizzleBase";
 * export const bulkDeleteByQuery = createStorageAwareBulkDeleteByQuery(base, "sample");
 */
export function createStorageAwareBulkDeleteByQuery<T extends BaseService>(
  base: T,
  domainKey: string
): (where: any) => Promise<void> {
  const storageFields = extractStorageFields(getDomainConfig(domainKey));

  return async (where: any): Promise<void> => {
    if (storageFields.length) {
      // searchを使って削除対象レコードを取得
      const result = await base.search?.({ where, limit: 10000 });
      const records = result?.results ?? [];
      await Promise.all(
        records.map((r) => cleanupStorageFiles(r, storageFields))
      );
    }
    await base.bulkDeleteByQuery?.(where);
  };
}
