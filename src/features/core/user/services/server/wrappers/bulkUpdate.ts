// src/features/core/user/services/server/wrappers/bulkUpdate.ts

import type { User } from "@/features/core/user/entities";
import type { BulkUpdateRecord, BulkUpdateResult } from "@/lib/crud/types";
import type { DbTransaction } from "@/lib/crud/drizzle/types";
import { base } from "../drizzleBase";
import { assertBulkUpdateIds, parseBulkUpdateFields, type UserBulkUpdateFields } from "../helpers/bulkUpdateFields";

/**
 * 副作用の無い列だけを一括で更新する(許可は USER_BULK_UPDATE.fields)。
 * update ラッパーのガード・履歴・Firebase 同期が要る列は入口で拒否するので、base を直接呼んでよい。
 */
export async function bulkUpdateByIds(
  ids: string[],
  data: UserBulkUpdateFields,
  tx?: DbTransaction,
): Promise<{ count: number }> {
  assertBulkUpdateIds(ids);
  return base.bulkUpdateByIds(ids, parseBulkUpdateFields(data) as never, tx);
}

export async function bulkUpdate(
  records: BulkUpdateRecord<UserBulkUpdateFields>[],
  tx?: DbTransaction,
): Promise<BulkUpdateResult<User>> {
  assertBulkUpdateIds(Array.isArray(records) ? records.map((record) => record?.id) : records);
  const parsed = records.map((record) => ({ id: record.id, data: parseBulkUpdateFields(record.data) }));
  return base.bulkUpdate(parsed as never, tx) as unknown as Promise<BulkUpdateResult<User>>;
}
