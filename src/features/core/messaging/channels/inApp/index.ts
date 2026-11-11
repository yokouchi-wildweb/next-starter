// src/features/core/messaging/channels/inApp/index.ts
//
// 上流の経路 inApp(お知らせ = message_inbox_items)。中身: ./createInAppChannel.ts

import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDeliveryTable } from "../../entities/delivery";
import { MessageDispatchTable } from "../../entities/drizzle";
import { MessageInboxItemTable } from "../../entities/inbox";
import { bindInboxImages } from "../../services/server/inbox/imageBinding";
import { storageInboxImageLedger } from "../../services/server/inbox/imageBindingLedger";
import { createInAppChannel } from "./createInAppChannel";

export const channel = createInAppChannel({
  now: () => new Date(),
  async findDispatchIds(deliveryIds) {
    if (deliveryIds.length === 0) return new Map();
    const rows = await db
      .select({ id: MessageDeliveryTable.id, dispatchId: MessageDeliveryTable.dispatch_id })
      .from(MessageDeliveryTable)
      .where(inArray(MessageDeliveryTable.id, [...deliveryIds]));
    return new Map(rows.map((row) => [row.id, row.dispatchId]));
  },
  async findExistingItems(pairs) {
    if (pairs.length === 0) return new Set();
    const rows = await db
      .select({ dispatchId: MessageInboxItemTable.dispatch_id, userId: MessageInboxItemTable.user_id })
      .from(MessageInboxItemTable)
      .where(
        or(
          ...pairs.map((pair) =>
            and(eq(MessageInboxItemTable.dispatch_id, pair.dispatchId), eq(MessageInboxItemTable.user_id, pair.userId)),
          ),
        ),
      );
    return new Set(rows.map((row) => `${row.dispatchId}|${row.userId}`));
  },
  async insertItems(rows) {
    await db.insert(MessageInboxItemTable).values([...rows]);
  },
  async bindImages(dispatchId, refs) {
    // 回の行を排他で持って結ぶ(並ぶ束・送り直しは対応 metadata.inboxImages を読んで同じファイルを使う)
    return db.transaction(async (tx) => {
      const [dispatch] = await tx
        .select({ id: MessageDispatchTable.id, actor_id: MessageDispatchTable.actor_id, metadata: MessageDispatchTable.metadata })
        .from(MessageDispatchTable)
        .where(eq(MessageDispatchTable.id, dispatchId))
        .for("update");
      if (!dispatch) return new Map(refs.map((ref) => [ref, ref]));
      const { map, metadata } = await bindInboxImages(storageInboxImageLedger, tx, { ...dispatch, metadata: dispatch.metadata ?? null }, refs);
      if (metadata) await tx.update(MessageDispatchTable).set({ metadata }).where(eq(MessageDispatchTable.id, dispatchId));
      return map;
    });
  },
});
