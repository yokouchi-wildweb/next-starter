// src/features/core/user/services/server/helpers/bulkUpdateFields.ts

import { z } from "zod";
import { USER_BULK_UPDATE } from "@/config/app/user-bulk-update.config";
import { UserCoreSchema } from "@/features/core/user/entities/schema";
import { DomainError } from "@/lib/errors";

const BULK_FIELDS: readonly string[] = USER_BULK_UPDATE.fields;

const BulkUpdateSchema = UserCoreSchema.pick(
  Object.fromEntries(USER_BULK_UPDATE.fields.map((field) => [field, true])) as {
    [K in (typeof USER_BULK_UPDATE.fields)[number]]: true;
  },
).partial();

export type UserBulkUpdateFields = z.infer<typeof BulkUpdateSchema>;

/**
 * 一括更新の入力を検査する。許可の無い列は黙って捨てず 400 にする(成功に見えて更新されない状態を作らない)。
 * base にはスキーマの検証が無いので、値の検証もここで行う。
 */
export function parseBulkUpdateFields(data: unknown): UserBulkUpdateFields {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new DomainError("更新データが不正です", { status: 400 });
  }
  const rejected = Object.keys(data).filter((key) => !BULK_FIELDS.includes(key));
  if (rejected.length > 0) {
    throw new DomainError(`一括更新できない項目です: ${rejected.join(", ")}`, { status: 400 });
  }
  const result = BulkUpdateSchema.safeParse(data);
  if (!result.success) {
    throw new DomainError("更新データが不正です", { status: 400 });
  }
  return result.data;
}

/** 対象の id を検査する(uuid 列に不正な文字列を渡すと 500 になるため、ここで 400 にする) */
export function assertBulkUpdateIds(ids: unknown): asserts ids is string[] {
  if (!z.array(z.string().uuid()).safeParse(ids).success) {
    throw new DomainError("対象のユーザー ID が不正です", { status: 400 });
  }
  if ((ids as string[]).length > USER_BULK_UPDATE.maxIds) {
    throw new DomainError(`一度に更新できるのは ${USER_BULK_UPDATE.maxIds} 件までです`, { status: 400 });
  }
}
