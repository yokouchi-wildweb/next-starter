// src/domains/core/messaging/services/server/admin/types.ts
//
// 管理の送信と読む口の型。記録の宛先の項目の型 MessageRecordTarget は lib/messaging(項目は持ち主のドメインの plugs/recordTargets/<名前>.ts)。

import type { MessageChannelCounts } from "../../../entities/schema";

/** 管理者が書いて送った文面(送信チャンネルごとの欄、差し込む前の字) */
export type AdminMessageContent = Record<string, unknown>;

/** 送った数(自由連絡の一括送信・定義の送信の結果と、記録の宛先の afterSend に返す) */
export type AdminBulkSendCounts = {
  /** 重複を除いた利用者の数 */
  recipientCount: number;
  /** 送信チャンネルごとの数(要求の中で分かった分。大きな送信は cron が足していく) */
  channelCounts: MessageChannelCounts;
  /** cron に任せた配達の数 */
  queuedCount: number;
};

