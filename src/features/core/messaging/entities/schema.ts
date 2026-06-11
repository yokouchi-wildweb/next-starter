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
 * message_dispatches.status の取り得る値。
 * - processing: 送信前に作成された行。処理中、または処理が異常終了した痕跡
 *   （processing のまま残っている行は「送信が走ったかもしれない」ことを示す）
 * - completed: 送信処理が最後まで走り、成功/失敗件数が確定した行
 */
export const MESSAGE_DISPATCH_STATUSES = ["processing", "completed"] as const;

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
