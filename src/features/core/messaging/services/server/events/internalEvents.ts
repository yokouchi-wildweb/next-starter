// src/features/core/messaging/services/server/events/internalEvents.ts
//
// 内部の事件(D47 の outbox): dispatch.completed・delivery.sent / delivery.failed / delivery.suppressed。
// - 元の状態の更新(配達の行・回の行)と同じ取引で message_events に書く(store の書く口が events を受ける)
// - 書くのは登録した購読のどれかが聞いている種類だけ(生成の一覧 extensions/subscribers から求める。購読が 0 なら何も書かない)
// - provider = "internal"、provider_event_id = 自前の uuid(UNIQUE(provider, provider_event_id) に当たらない)

import { randomUUID } from "node:crypto";

import type { MessageSubscriber } from "@/lib/messaging";

import type { MessageEventRowInsert } from "../../../entities/model";

export const INTERNAL_EVENT_PROVIDER = "internal";

/** 内部の事件の種類 */
export const INTERNAL_EVENT_TYPES = ["dispatch.completed", "delivery.sent", "delivery.failed", "delivery.suppressed"] as const;

/** 登録した購読が聞いている事件の種類 */
export function subscribedEventTypes(subscribers: readonly MessageSubscriber[]): ReadonlySet<string> {
  return new Set(subscribers.flatMap((subscriber) => subscriber.on.map(String)));
}

/** 配達の状態 → 内部の事件の種類(事件にしない状態は null) */
export function deliveryEventType(status: string): "delivery.sent" | "delivery.failed" | "delivery.suppressed" | null {
  if (status === "sent") return "delivery.sent";
  if (status === "failed") return "delivery.failed";
  if (status === "suppressed") return "delivery.suppressed";
  return null;
}

function internalEvent(values: Omit<MessageEventRowInsert, "provider" | "provider_event_id">): MessageEventRowInsert {
  return { ...values, provider: INTERNAL_EVENT_PROVIDER, provider_event_id: randomUUID() };
}

/** 配達の行の状態が変わった時の事件(聞いていなければ null) */
export function deliveryEvent(
  types: ReadonlySet<string>,
  row: { id: string; dispatch_id: string; channel: string; status: string; reason?: string | null },
  messageKey: string | null,
  occurredAt: Date,
): MessageEventRowInsert | null {
  const type = deliveryEventType(row.status);
  if (!type || !types.has(type)) return null;
  return internalEvent({
    delivery_id: row.id,
    dispatch_id: row.dispatch_id,
    message_key: messageKey,
    channel: row.channel,
    type,
    occurred_at: occurredAt,
    payload: row.reason ? { reason: row.reason } : {},
  });
}

/** 配達の行の束の事件(聞いていない種類は落とす) */
export function deliveryEvents(
  types: ReadonlySet<string>,
  rows: readonly { id: string; dispatch_id: string; channel: string; status: string; reason?: string | null }[],
  messageKey: string | null,
  occurredAt: Date,
): MessageEventRowInsert[] {
  if (types.size === 0) return [];
  return rows.flatMap((row) => {
    const event = deliveryEvent(types, row, messageKey, occurredAt);
    return event ? [event] : [];
  });
}

/** 回を閉じた時の事件(completed / completed_with_failures。聞いていなければ null) */
export function dispatchCompletedEvent(
  types: ReadonlySet<string>,
  dispatch: { id: string; message_key: string | null },
  status: string,
  occurredAt: Date,
  payload: Record<string, unknown> = {},
): MessageEventRowInsert | null {
  if (!types.has("dispatch.completed")) return null;
  return internalEvent({
    delivery_id: null,
    dispatch_id: dispatch.id,
    message_key: dispatch.message_key,
    channel: null,
    type: "dispatch.completed",
    occurred_at: occurredAt,
    payload: { status, ...payload },
  });
}
