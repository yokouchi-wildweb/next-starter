// src/domains/core/messaging/services/server/history/dto.ts
//
// 利用者ごとの履歴の 1 行(D37・D215)。1 行 = その利用者が受けた 1 送信。2 種:
// - dispatch: その利用者への配達を持つ送信。同じ送信のメール・お知らせ・LINE の配達は 1 行の channels にまとめる
// - sharedInApp: 全員・ロール宛ての共有のお知らせ(配達の行を持たない)で、その利用者の受け取り箱に見える物。配達の状態は無い(status・sentAt は null)
// 返すのはここに並べた項目だけ: 本文・vars・宛先(address / targets)・provider の値・誤りの文・送らなかった理由は出さない
// (本文は送信の詳細の物。行の dispatchId で送信の詳細のモーダルを開く、D37)

import type { MessageChannelTextMap } from "../../../entities/schema";
import { headingsOf } from "../admin/dispatchDto";
import type { UserHistoryDispatch, UserHistoryRow, UserSharedInAppRow } from "./userHistory";

/** その送信のその利用者への 1 送信チャンネルの配達 */
export type UserMessageHistoryChannel = {
  channel: string;
  /** 配達の状態(sharedInApp は null) */
  status: string | null;
  /** 送った時刻(sharedInApp は null) */
  sentAt: string | null;
};

export type UserMessageHistoryItem = {
  /** dispatch = 配達を持つ送信 / sharedInApp = 全員・ロール宛ての共有のお知らせ(配達の状態なし) */
  type: "dispatch" | "sharedInApp";
  dispatchId: string;
  /** 連絡定義の鍵(自由連絡・前の送る口の送信は null) */
  messageKey: string | null;
  kind: string | null;
  source: string;
  /** 送った人(送信の actor。type "admin" = 管理者が送った、それ以外 = 連絡の自動の送信。送信の詳細と同じ形) */
  actor: { id: string | null; type: string | null };
  /** 送信の理由・備考(管理者が入れた物。無ければ null) */
  reason: string | null;
  /** その送信の、送信チャンネルごとの件名・題 */
  headings: MessageChannelTextMap;
  /** この利用者への配達(送信チャンネルごと、配達を作った順。sharedInApp は inApp の 1 つ) */
  channels: UserMessageHistoryChannel[];
  /** 並びの時刻: その送信のこの利用者への最後の配達を作った時刻 / 共有のお知らせの公開の時刻 */
  createdAt: string;
};

function dispatchFields(dispatch: UserHistoryDispatch) {
  return {
    dispatchId: dispatch.id,
    messageKey: dispatch.message_key,
    kind: dispatch.kind,
    source: dispatch.source,
    actor: { id: dispatch.actor_id, type: dispatch.actor_type },
    reason: dispatch.reason,
    headings: headingsOf(dispatch),
  };
}

export function toUserHistoryItem(row: UserHistoryRow): UserMessageHistoryItem {
  return {
    type: "dispatch",
    ...dispatchFields(row.dispatch),
    channels: row.deliveries.map((delivery) => ({
      channel: delivery.channel,
      status: delivery.status,
      sentAt: delivery.sent_at ? delivery.sent_at.toISOString() : null,
    })),
    createdAt: row.at.toISOString(),
  };
}

export function toUserSharedInAppItem(row: UserSharedInAppRow): UserMessageHistoryItem {
  return {
    type: "sharedInApp",
    ...dispatchFields(row.dispatch),
    channels: [{ channel: "inApp", status: null, sentAt: null }],
    createdAt: row.item.published_at.toISOString(),
  };
}
