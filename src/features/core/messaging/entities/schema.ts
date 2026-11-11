// src/features/messaging/entities/schema.ts
//
// messaging の表の値の一覧と jsonb の Zod スキーマ。

import { z } from "zod";

/**
 * message_dispatches.status の取り得る値（scheduled → processing → completed /
 * completed_with_failures / cancelled）。
 * - scheduled: 予約された回（まだ送っていない）
 * - processing: 送信前に作成された行。処理中、または処理が異常終了した痕跡
 *   （processing のまま残っている行は「送信が走ったかもしれない」ことを示す）
 * - completed: 送信処理が最後まで走り、成功/失敗件数が確定した行
 * - completed_with_failures: 最後まで走ったが失敗した配達がある行
 * - cancelled: 1 通も送る前に止めた回（予約の取り消し・展開前）だけ。
 *   送った後の取り下げは status を変えず retracted_at を残す
 */
export const MESSAGE_DISPATCH_STATUSES = [
  "scheduled",
  "processing",
  "completed",
  "completed_with_failures",
  "cancelled",
] as const;

/** message_dispatches.expand_cursor の「展開を終えた」印(keyset の印・"i:<番号>" とぶつからない値) */
export const MESSAGE_EXPAND_DONE = "~done";

/** 「全体」を表す非 null の値（message_preferences の category / channel、message_suppressions の scope） */
export const MESSAGE_ALL = "*";

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

/** 宛先の停止の理由（message_suppressions.reason） */
export const MESSAGE_SUPPRESSION_REASONS = [
  "hard_bounce",
  "complaint",
  "one_click",
  "manual",
] as const;

/** 保存されたテンプレートの状態（message_templates.status） */
export const MESSAGE_TEMPLATE_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

/** 経路 1 本の数（message_dispatches.channel_counts の値） */
export const MessageChannelCountSchema = z.object({
  targeted: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped_no_address: z.number().int().nonnegative(),
  skipped_throttled: z.number().int().nonnegative(),
  suppressed: z.number().int().nonnegative(),
});

/** 経路ごとの数 { <channel>: MessageChannelCount }（経路は受け口なので鍵は固定しない） */
export const MessageChannelCountsSchema = z.record(
  z.string(),
  MessageChannelCountSchema,
);

/** 経路ごとの文字列 { <channel>: string }（message_dispatches.headings） */
export const MessageChannelTextMapSchema = z.record(z.string(), z.string());

/** 配達の宛先ごとの状態（message_deliveries.targets の要素。複数の宛先を持つ経路） */
export const MessageDeliveryTargetSchema = z.object({
  address: z.string(),
  status: z.enum(MESSAGE_DELIVERY_STATUSES),
  attempts: z.number().int().nonnegative(),
  next_attempt_at: z.string().nullable(),
  provider_message_id: z.string().nullable(),
  last_error: z.string().nullable(),
});

export const MessageDeliveryTargetsSchema = z.array(MessageDeliveryTargetSchema);

/** テンプレートの変数の宣言（message_templates.variables の要素） */
export const MessageTemplateVariableSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  type: z.string().min(1),
  required: z.boolean(),
  default: z.unknown().optional(),
  /** 由来（回に 1 組 = dispatch / 受信者ごと = recipient） */
  source: z.enum(["dispatch", "recipient"]),
});

export const MessageTemplateVariablesSchema = z.array(
  MessageTemplateVariableSchema,
);

export type MessageChannelCount = z.infer<typeof MessageChannelCountSchema>;
export type MessageChannelCounts = z.infer<typeof MessageChannelCountsSchema>;
export type MessageChannelTextMap = z.infer<typeof MessageChannelTextMapSchema>;
export type MessageDeliveryTarget = z.infer<typeof MessageDeliveryTargetSchema>;
export type MessageTemplateVariable = z.infer<
  typeof MessageTemplateVariableSchema
>;
