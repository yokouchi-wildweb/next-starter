// src/features/core/messaging/services/server/subscribers/types.ts

import type { MessageEvent } from "@/lib/messaging";

/** 購読へ渡す事件(seq つき) */
export type SubscriberEvent = MessageEvent & { seq: number };

/** 購読の cron の DB の読み書き(テストは偽物を渡す) */
export type SubscriberStore = {
  /** 印(渡し終えた seq。無ければ 0) */
  getMark: (subscriberKey: string) => Promise<number>;
  /** 印を進める(単調。小さい値では戻さない) */
  advanceMark: (subscriberKey: string, seq: number) => Promise<void>;
  /** created_at <= cutoff の事件の一番大きい seq(無ければ 0) */
  upperSeq: (cutoff: Date) => Promise<number>;
  /** after < seq <= upTo の事件を seq 順に(種類・連絡の鍵・経路で絞る) */
  fetchEvents: (query: {
    after: number;
    upTo: number;
    types: readonly string[];
    messages?: readonly string[];
    channels?: readonly string[];
    limit: number;
  }) => Promise<SubscriberEvent[]>;
  /** id の事件(再処理) */
  findEvents: (ids: readonly string[]) => Promise<SubscriberEvent[]>;
  /** 失敗を数える(attempts++、last_error)。上限に達したら quarantined_at を書く。数えた後の値 */
  recordFailure: (values: {
    subscriberKey: string;
    eventId: string;
    error: string;
    maxAttempts: number;
    now: Date;
  }) => Promise<{ attempts: number; quarantined: boolean }>;
  /** 成功した事件の失敗の行を消す */
  clearFailures: (subscriberKey: string, eventIds: readonly string[]) => Promise<void>;
  /** 隔離した事件の id(eventIds があればその中だけ) */
  listQuarantined: (subscriberKey: string, eventIds?: readonly string[]) => Promise<string[]>;
  /** 購読の印のうち一番小さい値(購読が無ければ null)。保持の掃除が読む */
  slowestMark: (subscriberKeys: readonly string[]) => Promise<number | null>;
};
