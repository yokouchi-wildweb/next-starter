// src/domains/core/messaging/services/server/sweep/expandImage.ts
//
// 展開の 1 束の書き込みのうち、全員・ロール宛ての共有のお知らせの行の画像(image と欄の中身の中の参照)を送信に結ぶ(inbox/imageBinding.ts)。
// store.expandOne が送信の行を排他で持った取引の中で呼ぶ。結んだ参照を行に書き、対応を足した metadata を送信の patch に入れる。

import type { MessageDispatch } from "../../../entities/model";
import { bindInboxImages, inboxItemImageRefs, withBoundInboxImages, type InboxImageLedger } from "../inbox/imageBinding";
import type { ExpansionWrite } from "./types";

export async function bindExpansionImage<Tx>(
  ledger: InboxImageLedger<Tx>,
  tx: Tx,
  dispatch: Pick<MessageDispatch, "id" | "actor_id" | "metadata">,
  write: ExpansionWrite,
): Promise<ExpansionWrite> {
  if (!write.inboxItem) return write;
  const refs = inboxItemImageRefs(write.inboxItem);
  if (refs.length === 0) return write;
  const base = { ...dispatch, metadata: (write.patch.metadata as Record<string, unknown> | null | undefined) ?? dispatch.metadata ?? null };
  const { map, metadata } = await bindInboxImages(ledger, tx, base, refs);
  return {
    ...write,
    inboxItem: withBoundInboxImages(write.inboxItem, map),
    patch: metadata ? { ...write.patch, metadata } : write.patch,
  };
}
