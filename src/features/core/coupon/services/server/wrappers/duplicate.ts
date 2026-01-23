// src/features/core/coupon/services/server/wrappers/duplicate.ts

import { getDomainConfig } from "@/lib/domain";
import {
  extractStorageFieldsWithPath,
  duplicateStorageFiles,
} from "@/lib/crud/storageIntegration";
import { base } from "../drizzleBase";
import { generateCouponCode } from "../../../utils/generateCode";

export async function duplicate(id: string): Promise<Record<string, unknown>> {
  const storageFieldsInfo = extractStorageFieldsWithPath(
    getDomainConfig("coupon")
  );

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

  // クーポン固有: 新しいコードを生成
  newData.code = generateCouponCode();

  // クーポン固有: 使用回数をリセット
  newData.current_total_uses = 0;

  if (storageFieldsInfo.length) {
    const newUrls = await duplicateStorageFiles(record, storageFieldsInfo);
    newData = { ...newData, ...newUrls };
  }

  return base.create(newData as Parameters<typeof base.create>[0]);
}
