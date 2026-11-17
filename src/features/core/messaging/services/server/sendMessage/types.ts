// src/features/core/messaging/services/server/sendMessage/types.ts
//
// 新しい送る口(sendMessage / sendMessageToMany)の入出力と、送る口が使う部品(deps)の型。

import type {
  MessageCategory,
  MessageChannel,
  MessageEmbeddedDeclaration,
  MessageEnricher,
  MessageLayout,
  MessageRegistry,
  MessageSystemTemplate,
} from "@/lib/messaging";

import type { SQL } from "drizzle-orm";

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
import type { MessageAdminOverrideSource } from "./definition";

/** 宛先 1 つ: 利用者(経路ごとに宛先を引く)か、経路の宛先を直に渡す */
export type MessageRecipient =
  | { userId: string }
  | { channel: string; address: string };

/**
 * 全員・ロール・ユーザーグループ(展開は cron が束ごとに行う)。
 * 全員・ロールは送り始めの時刻の線より後に登録した利用者を入れない。グループは送り始めの後に 1 文で一員を回の受信者の一覧へ書き、
 * その一覧だけから送る(D58)
 */
export type MessageTargetSpec =
  | { type: "all" }
  | { type: "role"; roles: readonly string[] }
  | { type: "group"; groupId: string };

/** ユーザーグループの読み口(userGroup の評価の口を門 userGroups の後ろで結ぶ。無い = グループ宛てを拒む) */
export type MessageGroupSource = {
  /** 門 userGroups が開か */
  enabled: () => boolean;
  /** 送り始めの確かめ(人数・上限、定期計算は固定する版)。404 / 409 / 503 は DomainError */
  sendTarget: (groupId: string) => Promise<{ count: number; memberLimit: number; overLimit: boolean; version: number | null }>;
  /** 固定の時の一員の述語(users に付ける)。上限・版・門も確かめる(DomainError) */
  memberWhere: (groupId: string, options: { version: number | null }) => Promise<{ where: SQL; count: number; timeoutMs: number }>;
};

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

/** 一括の送信(選んだ宛先の一覧か、宛先の指定 target のどちらか 1 つ) */
export type SendMessageToManyInput = CommonSendInput &
  (
    | { recipients: readonly MessageRecipient[]; target?: never }
    | { target: MessageTargetSpec; recipients?: never }
  ) & {
    /** 受信者ごとの値(鍵 = recipient_key: user:<id> | addr:<hash>) */
    recipientVars?: Readonly<Record<string, Record<string, unknown>>>;
    /** 後から登録した利用者にもお知らせを見せるか(既定 false) */
    showToLaterSignups?: boolean;
  };

/** 送る中身の出どころ: システムテンプレート(白紙)の鍵か、DB のテンプレートの今の公開版(読み込んだ版。今の公開版でなければ 409) */
export type MessageTemplateRef = { system: string } | { id: string; version: number };

/**
 * テンプレート + 欄の中身で送る(sendTemplateMessage、D117・D125)。管理の送る画面・一括送信も fork のコードからの管理の送信も同じ口。
 * テンプレートは送る時の公開版を回に固定する(予約なら予約の時の版)。専用の埋め込み情報の値は回に 1 組(受信者ごとの値は無い)
 */
export type SendTemplateMessageInput = Omit<SendMessageToManyInput, "recipientVars" | "vars"> & {
  /** 出どころ(白紙か DB のテンプレート) */
  template: MessageTemplateRef;
  /** ひな形の欄の中身(白紙・DB のテンプレートの版のひな形。{{鍵}} / {{別名}} のまま) */
  values: Record<string, unknown>;
  /** 版の中身から直したか(DB のテンプレートだけ。送る口は中身の違いでも直した印を付ける。false は信じない) */
  edited?: boolean;
  /** 送るカテゴリー(種別は管理者がその場で送れる物。白紙は同じ種別のカテゴリー)。経路はこの種類から */
  category: string;
  /** 専用の埋め込み情報の値 { 鍵: 値 }(DB のテンプレートと、宣言を持つシステムテンプレート。宣言の型で検査、必須。回の embedded_values に残る) */
  embedded?: Record<string, unknown>;
};

/** 回に残すテンプレートの出どころ(システムテンプレートの鍵か、DB のテンプレートの固定した版と直した印) */
export type MessageDispatchTemplateSource =
  | { system: string }
  | { template: { id: string; version: number; edited: boolean } };

/** テンプレートの公開した版(送る口が読む形) */
export type MessageTemplateVersionSource = {
  templateId: string;
  templateKey: string;
  version: number;
  category: string;
  /** ひな形の鍵・保存した時のひな形の版・欄の中身({{鍵}} / {{別名}} のまま) */
  layout: string;
  layoutVersion: number;
  values: Record<string, unknown>;
  /** 専用の埋め込み情報の宣言(送る人が値を入れる) */
  embedded: MessageEmbeddedDeclaration[];
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
  /** 要求の中で作った配達の行(大きな送信・全員・ロール・グループ宛てでは空。cron が展開する) */
  deliveries: MessageDeliveryOutcome[];
  /** queued のまま cron に任せた配達の行の数 */
  queuedCount: number;
  channelCounts: MessageChannelCounts;
  /** DB のテンプレートで送った時の出どころ(sendTemplateMessage だけ。edited = 版の中身から直したか) */
  template?: { id: string; version: number; edited: boolean };
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
  /** 全員・ロールの利用者 id を keyset で引く(id の昇順、利用できる利用者だけ。createdBefore = 送り始めの線、その時刻以前の登録だけ) */
  listUserIds: (
    filter: { roles?: readonly string[]; createdBefore?: Date },
    cursor: string | null,
    limit: number,
  ) => Promise<{ userIds: string[]; nextCursor: string | null }>;
  /** 全員・ロールの利用者の数(listUserIds と同じ条件。管理の送信の見込み) */
  countUserIds: (filter: { roles?: readonly string[] }) => Promise<number>;
  /** 回の受信者の一覧(グループ宛て)の利用者 id を keyset で引く(id の昇順、削除した利用者は外す) */
  listRecipientIds: (
    dispatchId: string,
    cursor: string | null,
    limit: number,
  ) => Promise<{ userIds: string[]; nextCursor: string | null }>;
  /**
   * 配信停止の好みの行(利用者 × (種類 か '*') × (経路 か '*')、kind は null か連絡の種別)。channel が '*' の行はそのまま '*' で返す
   * (種別まるごとの行 = kind X・'*'・'*' は種別 X の連絡の全経路に当たる)。
   * groupRow = 種類が入っているグループの行の category('group:<鍵>'、D123。無ければ省略か null)。その行も種類の行と同じに当たる
   */
  findOptOuts: (
    userIds: readonly string[],
    category: string,
    kind: string | null,
    channels: readonly string[],
    groupRow?: string | null,
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
  /**
   * 連絡のドメインが門で開いているか(鍵 <ドメイン>.<名前>、D77)。閉なら送る口は回も配達も作らず disabled を返し、
   * cron は置いてある行を送らずに先送りする。省略 = 常に開(テストの部品)
   */
  domainOpen?: (messageKey: string) => boolean;
  store: MessageSendStore;
  channels: Readonly<Record<string, MessageChannel>>;
  /** ひな形の受け口(server の一覧 layouts、D122)。定義の layout を照らし、欄の中身を検査して描く */
  layouts: Readonly<Record<string, MessageLayout>>;
  /** 経路の鍵 → ひな形の描き方を持つひな形の表(email = layoutEmails)。描き方の 3 段の 1 段目(sendMessage/content.ts) */
  layoutRenderers: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  enrichers: Readonly<Record<string, MessageEnricher>>;
  /** ユーザーグループ(無い = グループ宛てを 404 で拒む) */
  groups?: MessageGroupSource;
  registry: MessageRegistry;
  config: MessagingConfig;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** 共通の文脈の受信者に依らない値 */
  /** 共通の埋め込み情報のうち受信者に依らない値(サービス名・短い名前・起点の URL) */
  context: () => { serviceName: string; serviceNameShort: string; appBaseUrl: string };
  actor: () => { actorId: string | null; actorType: string | null };
  /** 登録した購読が聞いている事件の種類(内部の事件はこれだけ書く。無い・空 = 書かない) */
  eventTypes?: ReadonlySet<string>;
  /** categories の受け口(fork の種類の override を重ねた後)。定義の種類を照らし、種別と経路を引く */
  categories: Readonly<Record<string, MessageCategory>>;
  /** 会話の間引き(throttle のある連絡)。無ければ間引かない(throttle を見ないテスト) */
  throttle?: MessageThrottleStore;
  /** 管理画面の文言の上書き(無い = 重ねない。resolveDefinition が門の開閉を見て定義ごとに 1 回読む) */
  adminOverrides?: MessageAdminOverrideSource;
  /** システムテンプレートの受け口(管理の送信の白紙、D117)。無い = 白紙から送れない(400) */
  systemTemplates?: Readonly<Record<string, MessageSystemTemplate>>;
  /** 保存されたテンプレート(sendTemplateMessage の版の固定)。無ければテンプレートを呼び出して送れない */
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

