// src/features/core/messaging/services/server/sweep/types.ts
//
// 送信の掃き出し・続きを送る・保持の掃除の DB の読み書きの形(テストはメモリの偽物を渡す)。

import type {
  MessageDelivery,
  MessageDeliveryInsert,
  MessageDispatch,
  MessageDispatchInsert,
  MessageInboxItemInsert,
} from "../../../entities/model";
import type { MessageSendDeps } from "../sendMessage/types";

/** 展開の 1 束の書き込み */
export type ExpansionWrite = {
  rows: MessageDeliveryInsert[];
  patch: Partial<MessageDispatchInsert>;
  /** 全員・ロール宛てのお知らせの共有の 1 行(回の最初の束で 1 度だけ、D32) */
  inboxItem?: MessageInboxItemInsert;
};

/** 経路ごと・状態ごとの配達の行の数 */
export type DeliveryAggregate = { channel: string; status: string; count: number }[];

export type MessageSweepStore = {
  /** 予約の時刻が来た回を processing にする(返値 = 動かした数) */
  activateScheduled: (now: Date, limit: number) => Promise<number>;
  /**
   * 展開の続きがある回を 1 つ排他で取り(FOR UPDATE SKIP LOCKED)、step の書き込みを同じ取引で入れる。
   * dispatchId を渡すとその回だけ。取れなければ false
   */
  expandOne: (
    dispatchId: string | null,
    step: (dispatch: MessageDispatch) => Promise<ExpansionWrite>,
  ) => Promise<boolean>;
  /**
   * 送る時刻が来た配達の行を lease で取る(status → sending、locked_until、lock_token)。
   * 取る行 = next_attempt_at <= now かつ status queued | sent かつ lease が無いか切れた行
   */
  claimDue: (params: {
    now: Date;
    limit: number;
    leaseUntil: Date;
    lockToken: string;
    dispatchId?: string;
  }) => Promise<MessageDelivery[]>;
  /** lock_token が合う時だけ行を書く(lease を失った処理の書き込みを捨てる) */
  updateClaimed: (id: string, lockToken: string, patch: Partial<MessageDeliveryInsert>) => Promise<void>;
  /** sending のまま lease が切れた行を unknown にする(自動で送り直さない) */
  markStaleSending: (now: Date, limit: number) => Promise<number>;
  findDispatches: (ids: readonly string[]) => Promise<MessageDispatch[]>;
  /** 終えられる回(processing・展開済み・queued / sending の行が無い) */
  findCompletable: (limit: number, dispatchId?: string) => Promise<MessageDispatch[]>;
  aggregateDeliveries: (dispatchId: string) => Promise<DeliveryAggregate>;
  updateDispatch: (id: string, patch: Partial<MessageDispatchInsert>) => Promise<void>;
};

/** 保持の掃除の DB の読み書き(1 呼び出し = 1 文・最大 limit 行。回だけは画像を外すので 1 取引) */
export type MessageRetentionStore = {
  deleteEventsBefore: (cutoff: Date, limit: number) => Promise<number>;
  deleteDeliveriesBefore: (cutoff: Date, limit: number) => Promise<number>;
  /**
   * お知らせが参照せず、processing / scheduled でない回を消す。消す前に冪等の鍵を移し、回に結んだお知らせの画像
   * (metadata.inboxImages の値)を台帳から外す(同じ取引。detachedImages = 外した数)
   */
  deleteDispatchesBefore: (cutoff: Date, limit: number) => Promise<{ deleted: number; movedKeys: number; detachedImages: number }>;
  deleteIdempotencyKeysBefore: (cutoff: Date, limit: number) => Promise<number>;
};

export type MessageSweepDeps = MessageSendDeps & { sweepStore: MessageSweepStore; newToken: () => string };
