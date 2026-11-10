// src/features/core/messaging/services/server/webhooks/store.ts

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { MessageDeliveryTable, MessageEventTable } from "../../../entities/delivery";
import { MessageSuppressionTable } from "../../../entities/preference";
import { MESSAGE_ALL } from "../../../entities/schema";
import type { WebhookDeliveryRow, WebhookStore } from "./applyEvents";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const columns = {
  id: MessageDeliveryTable.id,
  status: MessageDeliveryTable.status,
  address: MessageDeliveryTable.address,
  sent_at: MessageDeliveryTable.sent_at,
  delivered_at: MessageDeliveryTable.delivered_at,
  failed_at: MessageDeliveryTable.failed_at,
  opened_at: MessageDeliveryTable.opened_at,
  clicked_at: MessageDeliveryTable.clicked_at,
  complained_at: MessageDeliveryTable.complained_at,
};

export const drizzleWebhookStore: WebhookStore = {
  async findDelivery({ provider, providerMessageId, deliveryId }) {
    if (providerMessageId) {
      const [row] = await db
        .select(columns)
        .from(MessageDeliveryTable)
        .where(
          and(eq(MessageDeliveryTable.provider, provider), eq(MessageDeliveryTable.provider_message_id, providerMessageId)),
        )
        .limit(1);
      if (row) return row as WebhookDeliveryRow;
    }
    if (deliveryId && UUID_PATTERN.test(deliveryId)) {
      const [row] = await db.select(columns).from(MessageDeliveryTable).where(eq(MessageDeliveryTable.id, deliveryId)).limit(1);
      if (row) return row as WebhookDeliveryRow;
    }
    return null;
  },
  async insertEvent({ deliveryId, provider, type, occurredAt, providerEventId, payload }) {
    const rows = await db
      .insert(MessageEventTable)
      .values({
        delivery_id: deliveryId,
        provider,
        type,
        occurred_at: occurredAt,
        provider_event_id: providerEventId,
        payload,
      })
      .onConflictDoNothing({ target: [MessageEventTable.provider, MessageEventTable.provider_event_id] })
      .returning({ id: MessageEventTable.id });
    return rows.length > 0;
  },
  async updateDelivery(id, patch) {
    await db
      .update(MessageDeliveryTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(MessageDeliveryTable.id, id));
  },
  async addSuppression({ channel, addressHash, reason, providerEventId, source }) {
    await db
      .insert(MessageSuppressionTable)
      .values({ channel, address_hash: addressHash, reason, scope: MESSAGE_ALL, source, provider_event_id: providerEventId })
      .onConflictDoNothing({
        target: [MessageSuppressionTable.channel, MessageSuppressionTable.address_hash, MessageSuppressionTable.scope],
      });
  },
};
