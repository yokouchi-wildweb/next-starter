// src/features/core/messaging/services/server/sendMessage/throttleStore.ts
//
// 会話の間引きの DB(drizzle)。鍵ごとに 1 取引: pg_advisory_xact_lock(hashtextextended(鍵, 0)) で排他し、
// 要求の中の送りと cron の送りが同じ鍵で重ならないようにする(取引の終わりで lock は外れる)。
// お知らせの画像は同じ取引の中で回に結ぶ(回の行を FOR UPDATE、inApp の経路の bindImages と同じ結び方)。

import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { db, type TransactionClient } from "@/lib/drizzle";

import { MessageDeliveryTable, MessageEventTable } from "../../../entities/delivery";
import { MessageDispatchTable } from "../../../entities/drizzle";
import { MessageInboxItemTable } from "../../../entities/inbox";
import type { MessageInboxItemInsert } from "../../../entities/model";
import { bindInboxImages } from "../inbox/imageBinding";
import { storageInboxImageLedger } from "../inbox/imageBindingLedger";
import { inboxReadSql } from "../inbox/readState";
import type { MessageThrottleStore, MessageThrottleTx } from "./types";

/** 画像を回に結んだ参照に替える(storage:// でない値はそのまま) */
async function bindImage(tx: TransactionClient, dispatchId: string, image: string | null | undefined): Promise<string | null> {
  if (!image) return image ?? null;
  const [dispatch] = await tx
    .select({ id: MessageDispatchTable.id, actor_id: MessageDispatchTable.actor_id, metadata: MessageDispatchTable.metadata })
    .from(MessageDispatchTable)
    .where(eq(MessageDispatchTable.id, dispatchId))
    .for("update");
  if (!dispatch) return image;
  const { map, metadata } = await bindInboxImages(
    storageInboxImageLedger,
    tx,
    { ...dispatch, metadata: dispatch.metadata ?? null },
    [image],
  );
  if (metadata) await tx.update(MessageDispatchTable).set({ metadata }).where(eq(MessageDispatchTable.id, dispatchId));
  return map.get(image) ?? image;
}

function throttleTx(tx: TransactionClient): MessageThrottleTx {
  const D = MessageDeliveryTable;
  const I = MessageInboxItemTable;
  return {
    async recipientRows(dispatchId, recipientKey) {
      return tx
        .select({
          id: D.id,
          dispatch_id: D.dispatch_id,
          channel: D.channel,
          status: D.status,
          reason: D.reason,
          throttle_key: D.throttle_key,
          attempts: D.attempts,
        })
        .from(D)
        .where(and(eq(D.dispatch_id, dispatchId), eq(D.recipient_key, recipientKey)))
        .for("update");
    },
    async findUnreadItem(userId, throttleKey) {
      const [row] = await tx
        .select({
          id: I.id,
          dispatch_id: I.dispatch_id,
          collapsed_count: I.collapsed_count,
          collapsed_dispatch_ids: I.collapsed_dispatch_ids,
        })
        .from(I)
        .where(and(eq(I.user_id, userId), eq(I.throttle_key, throttleKey), sql`NOT ${inboxReadSql(userId)}`))
        .orderBy(desc(I.published_at), desc(I.id))
        .limit(1)
        .for("update");
      return row ?? null;
    },
    async hasWindowAnchor(throttleKey, excludeDispatchId, since) {
      const [row] = await tx
        .select({ id: D.id })
        .from(D)
        .where(
          and(
            eq(D.throttle_key, throttleKey),
            ne(D.dispatch_id, excludeDispatchId),
            isNull(D.reason),
            or(
              and(inArray(D.status, ["sent", "delivered"]), isNotNull(D.sent_at), gt(D.sent_at, since)),
              inArray(D.status, ["queued", "sending"]),
            ),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async insertItem(row: MessageInboxItemInsert) {
      const image = await bindImage(tx, row.dispatch_id, row.image);
      await tx.insert(I).values({ ...row, image });
    },
    async replaceItem(id, patch) {
      const image = patch.dispatch_id ? await bindImage(tx, patch.dispatch_id, patch.image) : patch.image;
      await tx.update(I).set({ ...patch, image }).where(eq(I.id, id));
    },
    async updateDelivery(id, patch, events) {
      await tx.update(D).set(patch).where(eq(D.id, id));
      if (events?.length) await tx.insert(MessageEventTable).values([...events]);
    },
  };
}

export const drizzleMessageThrottleStore: MessageThrottleStore = {
  async withKey(throttleKey, fn) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${throttleKey}, 0))`);
      return fn(throttleTx(tx));
    });
  },
};
