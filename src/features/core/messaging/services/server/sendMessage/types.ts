// src/features/core/messaging/services/server/sendMessage/types.ts
//
// 新しい送る口(sendMessage / sendMessageToMany)の入出力と、送る口が使う部品(deps)の型。

import type {
  MessageAudience,
  MessageCategory,
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
  MessageEventRowInsert,
  MessageInboxItemInsert,
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
  /**
   * その回だけ経路を絞る(種類の経路の中から。足せない、空と種類の外は 400、D86)。省略 = 種類の経路の全部。
   * 管理者が手で送る時(管理の送信・一覧の一括・テンプレート)だけが渡す。コードから自動で送る連絡は渡さない
   */
  channels?: readonly string[];
  /** 二重送信を防ぐ鍵(message_dispatches と message_idempotency_keys の両方で確かめる) */
  idempotencyKey?: string;
  /** 送り元(省略 = 定義の鍵) */
  source?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  tags?: readonly string[];
  isTest?: boolean;
  /**
   * 予約の時刻(省略 = 今送る)。回を status scheduled で作り、展開も送信もしない(cron が時刻に拾う)。
   * 過ぎた時刻と config.schedule.maxDaysAhead より先は 400。required・秘密の連絡は予約できない
   */
  scheduledAt?: Date;
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

/**
 * 保存されたテンプレートで送る(sendTemplate)。送る時の公開版を回に固定する(予約なら予約の時の版)。
 * vars = テンプレートの変数の値(回に 1 組)。受信者ごとの変数は既定値を全員に使う(既定値が無ければ 400)
 */
export type SendTemplateInput = Omit<SendMessageToManyInput, "recipientVars"> & {
  templateId: string;
  /** 送る時の種類(既定 = 版の種類)。種別と経路はこの種類から。管理の送信の「取引」の選択は operatorDirect(指令 37 までの仮) */
  category?: string;
};

/** テンプレートの公開した版(送る口が読む形) */
export type MessageTemplateVersionSource = {
  templateId: string;
  templateKey: string;
  version: number;
  category: string;
  channels: string[];
  content: Record<string, unknown>;
  variables: { key: string; label: string; type: string; required: boolean; default?: unknown; source: "dispatch" | "recipient" }[];
};

/** テンプレートの読み口(送る口と cron) */
export type MessageTemplateSource = {
  /** 今の公開版(無い = null、取り下げ済み・未公開は status で返す) */
  loadCurrent: (
    templateId: string,
  ) => Promise<{ status: string; version: MessageTemplateVersionSource | null } | null>;
  /** 固定した版(cron が回から引き直す) */
  loadVersion: (templateId: string, version: number) => Promise<MessageTemplateVersionSource | null>;
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
  /** 回を更新する。events = 同じ取引で書く内部の事件(D47) */
  updateDispatch: (id: string, patch: Partial<MessageDispatchInsert>, events?: readonly MessageEventRowInsert[]) => Promise<void>;
  /**
   * 配達の行を入れる(UNIQUE(dispatch_id, channel, recipient_key) の重複は飛ばす)。
   * eventsFor = 入った行から同じ取引で書く内部の事件を作る
   */
  insertDeliveries: (
    rows: readonly MessageDeliveryInsert[],
    eventsFor?: (created: readonly MessageDelivery[]) => MessageEventRowInsert[],
  ) => Promise<MessageDelivery[]>;
  /** 配達の行を更新する。events = 同じ取引で書く内部の事件 */
  updateDelivery: (id: string, patch: Partial<MessageDeliveryInsert>, events?: readonly MessageEventRowInsert[]) => Promise<void>;
  findUsers: (ids: readonly string[]) => Promise<MessageUserRow[]>;
  /** 全員・ロールの利用者 id を keyset で引く(id の昇順、利用できる利用者だけ) */
  listUserIds: (
    filter: { roles?: readonly string[] },
    cursor: string | null,
    limit: number,
  ) => Promise<{ userIds: string[]; nextCursor: string | null }>;
  /** 全員・ロールの利用者の数(listUserIds と同じ条件。管理の送信の見込み) */
  countUserIds: (filter: { roles?: readonly string[] }) => Promise<number>;
  /**
   * 配信停止の好みの行(利用者 × (種類 か '*') × (経路 か '*')、kind は null か連絡の種別)。channel が '*' の行はそのまま '*' で返す
   * (種別まるごとの行 = kind X・'*'・'*' は種別 X の連絡の全経路に当たる)
   */
  findOptOuts: (
    userIds: readonly string[],
    category: string,
    kind: string | null,
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
  /**
   * 送れた宛先の端末の帳簿の last_used_at を at にする(経路ごとに 1 回。帳簿に無い宛先は何もしない)。
   * 送る口は失敗しても送信の結果を変えない
   */
  touchEndpoints: (channel: string, entries: readonly { userId: string; address: string }[], at: Date) => Promise<void>;
};

/** 間引きの判定が読む受信者の配達の行(鍵の lock の中で読み直す) */
export type ThrottleDeliveryRow = {
  id: string;
  dispatch_id: string;
  channel: string;
  status: MessageDeliveryStatus;
  reason: MessageDeliveryReason | null;
  throttle_key: string | null;
  attempts: number;
};

/** 置き換えられる未読の受信者ごとのお知らせ */
export type ThrottleInboxItem = {
  id: string;
  dispatch_id: string;
  collapsed_count: number;
  collapsed_dispatch_ids: string[] | null;
};

/** 鍵の lock を持った取引の中の読み書き */
export type MessageThrottleTx = {
  /** 回 × 受信者の配達の行(全部の経路) */
  recipientRows: (dispatchId: string, recipientKey: string) => Promise<ThrottleDeliveryRow[]>;
  /** 利用者の同じ鍵の未読の行(新しい順の最初) */
  findUnreadItem: (userId: string, throttleKey: string) => Promise<ThrottleInboxItem | null>;
  /** window の起点があるか: 同じ鍵・他の回・reason なしの行で、since より後に sent / delivered か、送り方を決めて送る途中(queued / sending) */
  hasWindowAnchor: (throttleKey: string, excludeDispatchId: string, since: Date) => Promise<boolean>;
  /** お知らせの行を書く(画像は回に結んでから) */
  insertItem: (row: MessageInboxItemInsert) => Promise<void>;
  /** 未読の行を最新の中身に置き換える(画像は回に結んでから) */
  replaceItem: (id: string, patch: Partial<MessageInboxItemInsert>) => Promise<void>;
  /** 配達の行を書く。events = 同じ取引で書く内部の事件 */
  updateDelivery: (id: string, patch: Partial<MessageDeliveryInsert>, events?: readonly MessageEventRowInsert[]) => Promise<void>;
};

/** 会話の間引きの DB(鍵ごとの排他。本物は pg_advisory_xact_lock、テストはメモリの mutex) */
export type MessageThrottleStore = {
  withKey: <T>(throttleKey: string, fn: (tx: MessageThrottleTx) => Promise<T>) => Promise<T>;
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
  /**
   * 管理画面の文言の上書き(message_overrides)。enabled() = 門 messagingOverrides が開か、load = その連絡の直した欄。
   * 無ければ(テスト・cron の補い)コードの値だけで送る
   */
  adminOverrides?: MessageAdminOverrideSource;
  /** 登録した購読が聞いている事件の種類(内部の事件はこれだけ書く。無い・空 = 書かない) */
  eventTypes?: ReadonlySet<string>;
  /** categories の受け口(fork の種類の override を重ねた後)。定義の種類を照らし、種別と経路を引く */
  categories: Readonly<Record<string, MessageCategory>>;
  /** 会話の間引き(throttle のある連絡)。無ければ間引かない(throttle を見ないテスト) */
  throttle?: MessageThrottleStore;
  /** 保存されたテンプレート(sendTemplate と cron の版の引き直し)。無ければテンプレートでは送れない */
  templates?: MessageTemplateSource;
  /** ワンクリックの配信停止(鍵の env があるか・停止の URL) */
  unsubscribe: {
    configured: () => boolean;
    /** messageKey / dispatchId = 停止を連絡・回に結ぶ値(トークンの mk / d) */
    url: (payload: {
      recipientKey: string;
      category: string;
      channel: string;
      addressHash?: string;
      messageKey?: string;
      dispatchId?: string;
    }) => string;
  };
};

/** 管理画面の文言の上書きの読み口(resolveDefinition が定義ごとに 1 回読む) */
export type MessageAdminOverrideSource = {
  enabled: () => boolean;
  load: (messageKey: string) => Promise<{ fieldPath: string; value: unknown }[]>;
};
