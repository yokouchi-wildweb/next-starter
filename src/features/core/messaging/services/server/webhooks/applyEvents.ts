// src/features/core/messaging/services/server/webhooks/applyEvents.ts
//
// provider の webhook の事件を記録と配達の行に当てる(D36・D44)。
// - 開封・クリック(opened / clicked)は計測の機能 messagingTracking が閉なら記録も反映もしない(既定 閉)
// - message_events に UNIQUE(provider, provider_event_id) で一度だけ入れる(もう入っていれば何もしない)
// - 配達の行は provider の message id で引き、無ければ送る時のタグの配達の id で引く
// - 状態は前にだけ進める(queued < sending・unknown < sent < delivered < bounced・failed。古い事件で戻さない)。
//   時刻は最初の 1 回だけ書く。suppressed・canceled の行の状態は変えない
// - bounced_hard と complained → message_suppressions(reason hard_bounce / complaint、scope '*')。bounced_soft は停止しない
// - unsubscribed(provider の仕組みの停止)は記録だけで好みに書かない(D35: provider の一括停止は使わない)
//
// 経路の事件の種類(メールの項目が決める語彙): sent / delivered / deferred / bounced_hard / bounced_soft / complained /
// opened / clicked / dropped / unsubscribed / other

import type { ChannelWebhookEvent } from "@/lib/messaging";

import type { MessageDeliveryStatus } from "../../../entities/model";
import { hashAddress } from "../sendMessage/stops";

export type WebhookDeliveryRow = {
  id: string;
  status: MessageDeliveryStatus;
  address: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  failed_at: Date | null;
  opened_at: Date | null;
  clicked_at: Date | null;
  complained_at: Date | null;
};

export type WebhookStore = {
  findDelivery: (params: {
    provider: string;
    providerMessageId: string | null;
    deliveryId: string | null;
  }) => Promise<WebhookDeliveryRow | null>;
  /** 事件を入れる(同じ provider × provider_event_id が既にあれば false) */
  insertEvent: (values: {
    deliveryId: string | null;
    provider: string;
    type: string;
    occurredAt: Date;
    providerEventId: string;
    payload: Record<string, unknown> | null;
  }) => Promise<boolean>;
  updateDelivery: (id: string, patch: Partial<Omit<WebhookDeliveryRow, "id" | "address">>) => Promise<void>;
  addSuppression: (values: {
    channel: string;
    addressHash: string;
    reason: "hard_bounce" | "complaint";
    providerEventId: string;
    source: string;
  }) => Promise<void>;
};

export type ApplyEventsDeps = { store: WebhookStore; trackingEnabled: () => boolean; now: () => Date };

export type ApplyEventsResult = { stored: number; duplicates: number; skippedTracking: number; unmatched: number };

const TRACKING_TYPES = new Set(["opened", "clicked"]);
const RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  unknown: 1,
  sent: 2,
  delivered: 3,
  bounced: 4,
  failed: 4,
};
const FROZEN = new Set(["suppressed", "canceled"]);

/** 事件の種類 → 進める状態と書く時刻 */
const EFFECTS: Record<string, { status?: MessageDeliveryStatus; at?: keyof WebhookDeliveryRow }> = {
  sent: { status: "sent", at: "sent_at" },
  delivered: { status: "delivered", at: "delivered_at" },
  bounced_hard: { status: "bounced", at: "failed_at" },
  bounced_soft: { status: "bounced", at: "failed_at" },
  dropped: { status: "failed", at: "failed_at" },
  complained: { at: "complained_at" },
  opened: { at: "opened_at" },
  clicked: { at: "clicked_at" },
};

function payloadOf(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

export async function applyChannelWebhookEvents(
  deps: ApplyEventsDeps,
  channel: string,
  events: readonly ChannelWebhookEvent[],
): Promise<ApplyEventsResult> {
  const result: ApplyEventsResult = { stored: 0, duplicates: 0, skippedTracking: 0, unmatched: 0 };
  const tracking = deps.trackingEnabled();
  for (const event of events) {
    if (TRACKING_TYPES.has(event.type) && !tracking) {
      result.skippedTracking += 1;
      continue;
    }
    const delivery = await deps.store.findDelivery({
      provider: event.provider,
      providerMessageId: event.providerMessageId,
      deliveryId: event.deliveryId ?? null,
    });
    const inserted = await deps.store.insertEvent({
      deliveryId: delivery?.id ?? null,
      provider: event.provider,
      type: event.type,
      occurredAt: event.occurredAt,
      providerEventId: event.providerEventId,
      payload: payloadOf(event.raw),
    });
    if (!inserted) {
      result.duplicates += 1;
      continue;
    }
    result.stored += 1;
    if (!delivery) result.unmatched += 1;

    if (delivery) {
      const effect = EFFECTS[event.type];
      const patch: Partial<Omit<WebhookDeliveryRow, "id" | "address">> = {};
      if (effect?.status && !FROZEN.has(delivery.status) && (RANK[effect.status] ?? 0) > (RANK[delivery.status] ?? 0)) {
        patch.status = effect.status;
      }
      if (effect?.at && !delivery[effect.at]) {
        (patch as Record<string, unknown>)[effect.at] = event.occurredAt;
      }
      if (Object.keys(patch).length > 0) await deps.store.updateDelivery(delivery.id, patch);
    }

    if (event.type === "bounced_hard" || event.type === "complained") {
      const address = event.address ?? delivery?.address ?? null;
      if (address) {
        await deps.store.addSuppression({
          channel,
          addressHash: hashAddress(address),
          reason: event.type === "complained" ? "complaint" : "hard_bounce",
          providerEventId: event.providerEventId,
          source: `webhook:${event.provider}`,
        });
      }
    }
  }
  return result;
}


