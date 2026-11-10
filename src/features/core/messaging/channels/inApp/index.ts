// src/features/core/messaging/channels/inApp/index.ts
//
// 上流の経路 inApp(お知らせ = message_inbox_items)。中身: ./createInAppChannel.ts

import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDeliveryTable } from "../../entities/delivery";
import { MessageInboxItemTable } from "../../entities/inbox";
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
});
