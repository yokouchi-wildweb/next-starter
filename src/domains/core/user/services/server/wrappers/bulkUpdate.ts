// src/domains/core/user/services/server/wrappers/bulkUpdate.ts

import type { User } from "@/domains/core/user/entities";
import type { BulkUpdateRecord, BulkUpdateResult } from "@/lib/crud";
import type { DbTransaction } from "@/lib/crud/server";
import { userBase } from "../userBase";
import { assertBulkUpdateIds, parseBulkUpdateFields, type UserBulkUpdateFields } from "../helpers/bulkUpdateFields";

/**
 * 副作用の無い列だけを一括で更新する(許可は userConfig.bulkUpdate.fields)。
 * update ラッパーのガード・履歴・Firebase 同期が要る列は入口で拒否するので、base を直接呼んでよい。
 */
export async function bulkUpdateByIds(
  ids: string[],
  data: UserBulkUpdateFields,
  tx?: DbTransaction,
): Promise<{ count: number }> {
  assertBulkUpdateIds(ids);
  return userBase.bulkUpdateByIds(ids, parseBulkUpdateFields(data) as never, tx);
}

export async function bulkUpdate(
  records: BulkUpdateRecord<UserBulkUpdateFields>[],
  tx?: DbTransaction,
): Promise<BulkUpdateResult<User>> {
  assertBulkUpdateIds(Array.isArray(records) ? records.map((record) => record?.id) : records);
  const parsed = records.map((record) => ({ id: record.id, data: parseBulkUpdateFields(record.data) }));
  return userBase.bulkUpdate(parsed as never, tx) as unknown as Promise<BulkUpdateResult<User>>;
}
