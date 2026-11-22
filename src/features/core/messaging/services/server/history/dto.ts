// src/features/core/messaging/services/server/history/dto.ts
//
// 利用者ごとの履歴の 1 行(D37)。1 行 = その利用者への 1 配達(1 送信チャンネル)と、その送信の見出し。
// 返すのはここに並べた項目だけ: 本文・vars・宛先(address / targets)・provider の値・誤りの文・送らなかった理由は出さない

import type { MessageChannelTextMap } from "../../../entities/schema";
import { headingsOf } from "../admin/dispatchDto";
import type { UserHistoryRow } from "./userHistory";

export type UserMessageHistoryItem = {
  dispatchId: string;
  /** 連絡定義の鍵(前の送る口の送信は null) */
  messageKey: string | null;
  kind: string | null;
  source: string;
  /** この配達の送信チャンネル */
  channel: string;
  /** この配達の状態 */
  status: string;
  /** その送信の、送信チャンネルごとの件名・題 */
  headings: MessageChannelTextMap;
  createdAt: string;
  sentAt: string | null;
};

export function toUserHistoryItem(row: UserHistoryRow): UserMessageHistoryItem {
  return {
    dispatchId: row.dispatch.id,
    messageKey: row.dispatch.message_key,
    kind: row.dispatch.kind,
    source: row.dispatch.source,
    channel: row.delivery.channel,
    status: row.delivery.status,
    headings: headingsOf(row.dispatch),
    createdAt: row.delivery.createdAt.toISOString(),
    sentAt: row.delivery.sent_at ? row.delivery.sent_at.toISOString() : null,
  };
}
