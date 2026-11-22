// src/domains/core/messaging/services/server/history/dto.ts
//
// 利用者ごとの履歴の 1 行(D37・D215)。2 種:
// - delivery: その利用者への 1 配達(1 送信チャンネル)と、その送信の見出し
// - sharedInApp: 全員・ロール宛ての共有のお知らせの 1 行(配達の行を持たない)で、その利用者の受け取り箱に見える物。配達の状態は無い(status・sentAt は null)
// 返すのはここに並べた項目だけ: 本文・vars・宛先(address / targets)・provider の値・誤りの文・送らなかった理由は出さない

import type { MessageChannelTextMap } from "../../../entities/schema";
import { headingsOf } from "../admin/dispatchDto";
import type { UserHistoryRow, UserSharedInAppRow } from "./userHistory";

export type UserMessageHistoryItem = {
  /** delivery = 配達 / sharedInApp = 全員・ロール宛ての共有のお知らせ(配達の状態なし) */
  type: "delivery" | "sharedInApp";
  dispatchId: string;
  /** 連絡定義の鍵(前の送る口の送信は null) */
  messageKey: string | null;
  kind: string | null;
  source: string;
  /** この配達の送信チャンネル(sharedInApp は "inApp") */
  channel: string;
  /** この配達の状態(sharedInApp は null) */
  status: string | null;
  /** その送信の、送信チャンネルごとの件名・題 */
  headings: MessageChannelTextMap;
  /** 並びの時刻: 配達を作った時刻 / 共有のお知らせの公開の時刻 */
  createdAt: string;
  /** 送った時刻(sharedInApp は null) */
  sentAt: string | null;
};

export function toUserHistoryItem(row: UserHistoryRow): UserMessageHistoryItem {
  return {
    type: "delivery",
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

export function toUserSharedInAppItem(row: UserSharedInAppRow): UserMessageHistoryItem {
  return {
    type: "sharedInApp",
    dispatchId: row.dispatch.id,
    messageKey: row.dispatch.message_key,
    kind: row.dispatch.kind,
    source: row.dispatch.source,
    channel: "inApp",
    status: null,
    headings: headingsOf(row.dispatch),
    createdAt: row.item.published_at.toISOString(),
    sentAt: null,
  };
}
