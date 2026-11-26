// src/domains/core/messaging/entities/messageDelivery/schema.ts

import { z } from "zod";

/**
 * message_deliveries.status の取り得る値（上流の一覧。苦情は状態にせず complained_at と事件）。
 * queued → sending → sent → delivered / failed / bounced / suppressed / canceled / unknown
 */
export const MESSAGE_DELIVERY_STATUSES = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "suppressed",
  "canceled",
  "unknown",
] as const;
/** 送らなかった理由（message_deliveries.reason） */
export const MESSAGE_DELIVERY_REASONS = [
  "no_address",
  "preference",
  "suppression",
  "throttled",
  "channel_off",
] as const;
/** 配達の宛先ごとの状態（message_deliveries.targets の要素。複数の宛先を持つ送信チャンネル） */
export const MessageDeliveryTargetSchema = z.object({
  address: z.string(),
  status: z.enum(MESSAGE_DELIVERY_STATUSES),
  attempts: z.number().int().nonnegative(),
  next_attempt_at: z.string().nullable(),
  provider_message_id: z.string().nullable(),
  last_error: z.string().nullable(),
});
export const MessageDeliveryTargetsSchema = z.array(MessageDeliveryTargetSchema);
export type MessageDeliveryTarget = z.infer<typeof MessageDeliveryTargetSchema>;
