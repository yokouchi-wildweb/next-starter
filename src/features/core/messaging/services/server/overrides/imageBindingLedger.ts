// src/features/core/messaging/services/server/overrides/imageBindingLedger.ts
//
// 文言の上書きの画像の結び付け(imageBinding.ts)の本物の台帳。読んだ台帳の行は判断にだけ使い、HTTP には返さない。

import "server-only";

import { findStorageObjectById } from "@/features/core/storageObject/services/server/finders/findStorageObjectById";
import { storageObjectService } from "@/features/core/storageObject/services/server/storageObjectService";
import type { TransactionClient } from "@/lib/drizzle";
import { parseStorageRef } from "@/lib/storage";

import { OVERRIDE_IMAGE_PURPOSE, OVERRIDE_IMAGE_RECORD_TYPE, type OverrideImageLedger } from "./imageBinding";

export const storageOverrideImageLedger: OverrideImageLedger<TransactionClient> = {
  async find(ref) {
    const parsed = parseStorageRef(ref);
    if (!parsed) return null;
    const row = await findStorageObjectById(parsed.ledgerId);
    if (!row) return null;
    return {
      status: row.status,
      purpose: row.purpose,
      ownerUserId: row.ownerUserId,
      recordType: row.recordType,
      recordId: row.recordId,
    };
  },
  async attach(tx, { ref, actorUserId, rowId, fieldPath }) {
    await storageObjectService.attach(
      {
        ref,
        purpose: OVERRIDE_IMAGE_PURPOSE,
        actorUserId,
        record: { type: OVERRIDE_IMAGE_RECORD_TYPE, id: rowId, field: fieldPath },
      },
      tx,
    );
  },
  async copy(ref) {
    // 管理者の保存の中の複製(service で管理者を確かめた後)
    const { ref: copied } = await storageObjectService.copy({ source: ref, purpose: OVERRIDE_IMAGE_PURPOSE, ownerUserId: null });
    return copied;
  },
  async detach(tx, { refs, rowId, reason }) {
    const rows = await storageObjectService.detach({ refs, record: { type: OVERRIDE_IMAGE_RECORD_TYPE, id: rowId }, reason }, tx);
    return rows.map((row) => row.id);
  },
  async cleanup(ids) {
    for (const id of ids) await storageObjectService.cleanupDeletedObject(id);
  },
};
