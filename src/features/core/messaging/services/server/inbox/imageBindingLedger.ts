// src/features/core/messaging/services/server/inbox/imageBindingLedger.ts
//
// お知らせの画像の結び付け(imageBinding.ts)の本物の台帳。storageObjectService の attach / copy と台帳の 1 行の読み取り。
// 読んだ台帳の行は判断にだけ使い、HTTP には返さない。

import "server-only";

import { findStorageObjectById } from "@/features/core/storageObject/services/server/finders/findStorageObjectById";
import { storageObjectService } from "@/features/core/storageObject/services/server/storageObjectService";
import type { TransactionClient } from "@/lib/drizzle";
import { parseStorageRef } from "@/lib/storage";

import {
  INBOX_IMAGE_PURPOSE,
  INBOX_IMAGE_RECORD_FIELD,
  INBOX_IMAGE_RECORD_TYPE,
  type InboxImageLedger,
} from "./imageBinding";

export const storageInboxImageLedger: InboxImageLedger<TransactionClient> = {
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
  async attach(tx, { ref, actorUserId, dispatchId }) {
    await storageObjectService.attach(
      {
        ref,
        purpose: INBOX_IMAGE_PURPOSE,
        actorUserId,
        record: { type: INBOX_IMAGE_RECORD_TYPE, id: dispatchId, field: INBOX_IMAGE_RECORD_FIELD },
      },
      tx,
    );
  },
  async copy(ref) {
    // 送る処理(サーバーの中)の複製。宛先を決めた管理者・定義が認可済みの前提(issueCodeForOwner と同じ)
    const { ref: copied } = await storageObjectService.copy({ source: ref, purpose: INBOX_IMAGE_PURPOSE, ownerUserId: null });
    return copied;
  },
};

/** 回から外す(保持の掃除が回を消す前、同じ取引で)。外した台帳の行の id を返す(実物は commit の後に消す) */
export async function detachInboxImages(tx: TransactionClient, dispatchId: string, refs: readonly string[]): Promise<string[]> {
  if (refs.length === 0) return [];
  const rows = await storageObjectService.detach(
    { refs, record: { type: INBOX_IMAGE_RECORD_TYPE, id: dispatchId }, reason: "record_removed" },
    tx,
  );
  return rows.map((row) => row.id);
}

/** 外した行の実物を消す(commit の後。失敗は storage の掃除が拾う) */
export async function cleanupDetachedInboxImages(ids: readonly string[]): Promise<void> {
  for (const id of ids) await storageObjectService.cleanupDeletedObject(id);
}
