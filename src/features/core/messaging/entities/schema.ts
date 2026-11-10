// src/features/messaging/entities/schema.ts
//
// API ルート / クライアント送信フォームで利用する Zod スキーマ。
// 業務上のクロス条件（"channels に email を含むなら emailSubject 必須" 等）は
// .superRefine で記述し、サーバー側 send/bulkSend では DomainError として再検証する。

import { z } from "zod";

import {
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_EMAIL_SUBJECT_MAX_LENGTH,
  MESSAGE_NOTIFICATION_TITLE_MAX_LENGTH,
} from "../constants/limits";

const MessagingChannelSchema = z.enum(["email", "inApp"]);

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

/**
 * 受信者は ID のみを受け取り、email / name は内部で DB から取得する。
 * 将来 caller 側で予め取得した user を渡したくなった場合は別 API を切る。
 */
const RecipientSchema = z.object({
  id: z.string().min(1),
});

const baseShape = {
  channels: z.array(MessagingChannelSchema).min(1),
  emailSubject: z
    .string()
    .trim()
    .min(1)
    .max(MESSAGE_EMAIL_SUBJECT_MAX_LENGTH)
    .optional(),
  emailBody: z.string().trim().min(1).max(MESSAGE_BODY_MAX_LENGTH).optional(),
  notificationTitle: z
    .string()
    .trim()
    .min(1)
    .max(MESSAGE_NOTIFICATION_TITLE_MAX_LENGTH)
    .optional(),
  notificationBody: z
    .string()
    .trim()
    .min(1)
    .max(MESSAGE_BODY_MAX_LENGTH)
    .optional(),
  source: z.string().min(1),
  reason: z.string().max(500).optional(),
  /**
   * 二重送信防止用の冪等性キー（クライアント発行、crypto.randomUUID() 推奨）。
   * 同一キーでの再実行は送信開始前に 409 で拒否される。
   * 省略時は冪等性チェックなし（互換のため任意。新規の送信 UI では必ず渡すこと）。
   */
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
} as const;

function requireChannelContent(
  input: {
    channels: ("email" | "inApp")[];
    emailSubject?: string;
    emailBody?: string;
    notificationTitle?: string;
    notificationBody?: string;
  },
  ctx: z.RefinementCtx,
): void {
  if (input.channels.includes("email")) {
    if (!input.emailSubject || !input.emailBody) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "channels に 'email' が含まれる場合、emailSubject と emailBody は必須です",
        path: ["emailSubject"],
      });
    }
  }
  if (input.channels.includes("inApp")) {
    if (!input.notificationTitle || !input.notificationBody) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "channels に 'inApp' が含まれる場合、notificationTitle と notificationBody は必須です",
        path: ["notificationTitle"],
      });
    }
  }
}

export const MessagingSendInputSchema = z
  .object({
    ...baseShape,
    recipient: RecipientSchema,
  })
  .superRefine((input, ctx) => requireChannelContent(input, ctx));

export const MessagingBulkSendInputSchema = z
  .object({
    ...baseShape,
    recipients: z.array(RecipientSchema).min(1),
    options: z
      .object({
        /**
         * 1 チャンク内で並列実行する送信数（= 実質的な最大並列メール送信数）。
         * 既定 50。プロバイダのレート制限に応じて調整する。
         */
        chunkSize: z.number().int().positive().max(500).optional(),
      })
      .optional(),
  })
  .superRefine((input, ctx) => requireChannelContent(input, ctx));
