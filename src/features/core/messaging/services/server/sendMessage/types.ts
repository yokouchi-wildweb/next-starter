// src/features/core/messaging/services/server/sendMessage/types.ts
//
// 新しい送る口(sendMessage / sendMessageToMany)の入出力と、送る口が使う部品(deps)の型。

import type {
  MessageAudience,
  MessageChannel,
  MessageEnricher,
  MessageRegistry,
} from "@/lib/messaging";

import type { MessagingConfig } from "../../../config";
import type {
  MessageDelivery,
  MessageDeliveryInsert,
  MessageDeliveryReason,
  MessageDeliveryStatus,
  MessageDispatchInsert,
  MessageDispatchStatus,
} from "../../../entities/model";
import type { MessageChannelCounts } from "../../../entities/schema";

/** 宛先 1 つ: 利用者(経路ごとに宛先を引く)か、経路の宛先を直に渡す */
export type MessageRecipient =
  | { userId: string }
  | { channel: string; address: string };

/** 全員・ロール・audiences の受け口の項目(展開は cron が束ごとに行う) */
export type MessageAudienceSpec =
  | { type: "all" }
  | { type: "role"; roles: readonly string[] }
  | { type: "audience"; key: string; args?: unknown };

type CommonSendInput = {
  /** 定義の vars に渡す値(定義の zod で検査する) */
  vars: Record<string, unknown>;
  /** 送る経路(省略 = 定義の defaultChannels) */
  channels?: readonly string[];
  /** 二重送信を防ぐ鍵(message_dispatches と message_idempotency_keys の両方で確かめる) */
  idempotencyKey?: string;
  /** 送り元(省略 = 定義の鍵) */
  source?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  tags?: readonly string[];
  isTest?: boolean;
};

/** 1 通(1 人)の送信 */
export type SendMessageInput = CommonSendInput & {
  recipient: MessageRecipient;
  /** その受信者だけの値(定義の vars の鍵・共通の文脈の鍵は上書きできない) */
  recipientVars?: Record<string, unknown>;
};

/** 一括の送信(選んだ宛先の一覧か、audience のどちらか 1 つ) */
export type SendMessageToManyInput = CommonSendInput &
  (
    | { recipients: readonly MessageRecipient[]; audience?: never }
    | { audience: MessageAudienceSpec; recipients?: never }
  ) & {
    /** 受信者ごとの値(鍵 = recipient_key: user:<id> | addr:<hash>) */
    recipientVars?: Readonly<Record<string, Record<string, unknown>>>;
    /** 後から登録した利用者にもお知らせを見せるか(既定 false) */
    showToLaterSignups?: boolean;
  };

/** 配達の行 1 つの結果(呼び手に返す) */
export type MessageDeliveryOutcome = {
  deliveryId: string;
  recipientKey: string;
  userId: string | null;
  channel: string;
  status: MessageDeliveryStatus;
  reason: MessageDeliveryReason | null;
};

/** 送る口の戻り値 */
export type SendMessageResult = {
  /** 回の id(連絡が止められている時は null) */
  dispatchId: string | null;
  /** disabled = 上書きで enabled:false の連絡(回を作らない) */
  status: MessageDispatchStatus | "disabled";
  /** 要求の中で作った配達の行(大きな送信・audience では空。cron が展開する) */
  deliveries: MessageDeliveryOutcome[];
  /** queued のまま cron に任せた配達の行の数 */
  queuedCount: number;
  channelCounts: MessageChannelCounts;
};

/** 送る口が読む利用者 */
export type MessageUserRow = { id: string; name: string | null; email: string | null };

/** 送る口の DB の読み書き(テストは偽物を渡す) */
export type MessageSendStore = {
  /** 鍵が message_dispatches か message_idempotency_keys に既にあるか */
  idempotencyKeyExists: (key: string) => Promise<boolean>;
  /** 回を 1 行入れる。鍵の UNIQUE 違反は MessageIdempotencyConflict を投げる */
  insertDispatch: (values: MessageDispatchInsert) => Promise<{ id: string }>;
  updateDispatch: (id: string, patch: Partial<MessageDispatchInsert>) => Promise<void>;
  /** 配達の行を入れる(UNIQUE(dispatch_id, channel, recipient_key) の重複は飛ばす) */
  insertDeliveries: (rows: readonly MessageDeliveryInsert[]) => Promise<MessageDelivery[]>;
  updateDelivery: (id: string, patch: Partial<MessageDeliveryInsert>) => Promise<void>;
  findUsers: (ids: readonly string[]) => Promise<MessageUserRow[]>;
  /** 全員・ロールの利用者 id を keyset で引く(id の昇順、利用できる利用者だけ) */
  listUserIds: (
    filter: { roles?: readonly string[] },
    cursor: string | null,
    limit: number,
  ) => Promise<{ userIds: string[]; nextCursor: string | null }>;
  /**
   * 配信停止の好みの行(利用者 × (種類 か '*') × (経路 か '*'))。channel が '*' の行はそのまま '*' で返す
   */
  findOptOuts: (
    userIds: readonly string[],
    category: string,
    channels: readonly string[],
  ) => Promise<{ userId: string; channel: string }[]>;
  /** 宛先の停止の行(経路 × address_hash) */
  findSuppressions: (
    channel: string,
    addressHashes: readonly string[],
  ) => Promise<{ addressHash: string; reason: string; scope: string }[]>;
  /** 端末の帳簿の有効な宛先(経路が resolveAddresses を持たない時) */
  findActiveEndpoints: (
    channel: string,
    userIds: readonly string[],
  ) => Promise<{ userId: string; address: string }[]>;
};

/** 送る口が使う部品 */
export type MessageSendDeps = {
  store: MessageSendStore;
  channels: Readonly<Record<string, MessageChannel>>;
  enrichers: Readonly<Record<string, MessageEnricher>>;
  audiences: Readonly<Record<string, MessageAudience>>;
  registry: MessageRegistry;
  config: MessagingConfig;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** 共通の文脈の受信者に依らない値 */
  context: () => { serviceName: string; appBaseUrl: string };
  actor: () => { actorId: string | null; actorType: string | null };
  /** ワンクリックの配信停止(鍵の env があるか・停止の URL) */
  unsubscribe: {
    configured: () => boolean;
    url: (payload: { recipientKey: string; category: string; channel: string; addressHash?: string }) => string;
  };
};
