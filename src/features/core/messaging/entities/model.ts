// src/features/messaging/entities/model.ts

import type { z } from "zod";

import { MessageDispatchTable } from "./drizzle";
import type {
  MessagingBulkSendInputSchema,
  MessagingSendInputSchema,
} from "./schema";
import type { MESSAGE_DISPATCH_STATUSES } from "./schema";

export type MessageDispatch = typeof MessageDispatchTable.$inferSelect;
export type MessageDispatchInsert = typeof MessageDispatchTable.$inferInsert;

/** 送信ジョブの状態（値の意味は schema.ts の MESSAGE_DISPATCH_STATUSES を参照） */
export type MessageDispatchStatus = (typeof MESSAGE_DISPATCH_STATUSES)[number];

export type MessagingSendInput = z.infer<typeof MessagingSendInputSchema>;
export type MessagingBulkSendInput = z.infer<
  typeof MessagingBulkSendInputSchema
>;

/** チャネル別の試行結果 */
export type MessagingChannelResult = {
  attempted: boolean;
  /** メールなら送信成功、通知ならジョブ単位の作成成功 */
  succeeded: boolean;
  error: string | null;
};

/** 受信者ごとの結果（バルクの per-recipient および呼び出し元の表示用） */
export type MessagingRecipientResult = {
  userId: string;
  /**
   * 送信時点で DB に記録されていたメールアドレス（参考表示用）。
   * email チャネルを使わなかった場合や、ユーザーが見つからなかった場合は null。
   * 監査ログ metadata には含めない（PII / 容量の観点）。
   */
  recipientEmail: string | null;
  email: MessagingChannelResult;
  inApp: MessagingChannelResult;
};

/** 単発送信 send() の戻り値 */
export type MessagingSendResult = {
  dispatchId: string;
  recipient: MessagingRecipientResult;
};

/** バルク送信 bulkSend() の戻り値 */
export type MessagingBulkSendResult = {
  dispatchId: string;
  recipientCount: number;
  emailSuccessCount: number;
  emailFailedCount: number;
  /** 通知レコードが作成されたか（試行していない場合は null） */
  notificationCreated: boolean | null;
  perRecipient: MessagingRecipientResult[];
};
