// src/features/core/messaging/services/server/templates/imageBindingLedger.ts
//
// テンプレートの画像の結び付け(imageBinding.ts)の本物の台帳。読んだ台帳の行は判断にだけ使い、HTTP には返さない。

import "server-only";

import { findStorageObjectById } from "@/features/core/storageObject/services/server/finders/findStorageObjectById";
import { storageObjectService } from "@/features/core/storageObject/services/server/storageObjectService";
import type { TransactionClient } from "@/lib/drizzle";
import { parseStorageRef } from "@/lib/storage";

import {
  TEMPLATE_IMAGE_PURPOSE,
  TEMPLATE_IMAGE_RECORD_FIELD,
  TEMPLATE_IMAGE_RECORD_TYPE,
  type TemplateImageLedger,
} from "./imageBinding";

export const storageTemplateImageLedger: TemplateImageLedger<TransactionClient> = {
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
  async attach(tx, { ref, actorUserId, templateId }) {
    await storageObjectService.attach(
      {
        ref,
        purpose: TEMPLATE_IMAGE_PURPOSE,
        actorUserId,
        record: { type: TEMPLATE_IMAGE_RECORD_TYPE, id: templateId, field: TEMPLATE_IMAGE_RECORD_FIELD },
      },
      tx,
    );
  },
  async copy(ref) {
    // 管理者の保存の中の複製(service で管理者を確かめた後)
    const { ref: copied } = await storageObjectService.copy({ source: ref, purpose: TEMPLATE_IMAGE_PURPOSE, ownerUserId: null });
    return copied;
  },
};
