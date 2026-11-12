// src/lib/messaging/receptacles/types.ts
//
// messaging の受け口(src/features/core/messaging/extensionPoints.ts)の項目の型。
// 項目は messaging/<受け口>/<名前>.ts に export const <単数> = { … } で置き、pnpm generate extensions が一覧にする。
// 送る口・記録・購読の cron(読み手)は連絡のドメインの作り直しの切り替えの区切りで作る。ここは項目の形の約束だけ。

import type { z } from "zod";

import type { ChannelErrorKind } from "../definition/errors";
import type { MessageKey, MessageKind } from "../definition/types";

// ---------------------------------------------------------------------------
// channels: 経路(上流の email・inApp・line も fork の経路も同じ形)
// ---------------------------------------------------------------------------

/** 経路の宛先 1 つ */
export type ChannelAddress = {
  /** 受信者(利用者が居ない宛先は null) */
  userId: string | null;
  /** 経路の中の宛先(メールアドレス・LINE の id・プッシュのトークン。inApp は利用者 id) */
  address: string;
};

/** 経路へ渡す 1 宛先分の送信 */
export type ChannelSendTarget = ChannelAddress & {
  /** 連絡の鍵(<ドメイン>.<名前>)。メールの経路はこれで生成の一覧の描き方(messages/views)を引く */
  messageKey: MessageKey;
  /** 宛先まで含む冪等の鍵(provider の冪等の鍵に渡す) */
  idempotencyKey: string;
  /** その宛先へ描いた中身(経路の欄の値。{{鍵}} は差し込み済み) */
  content: Record<string, unknown>;
  /**
   * 配信停止の種類の鍵。好みに従う連絡(種別が transactional でなく required でもない)の時だけ入る。
   * 入っている = 受信者が止められる連絡(メールは List-Unsubscribe を付ける)
   */
  category?: string;
  /** 送る側が付ける追加のヘッダ(例 List-Unsubscribe・List-Unsubscribe-Post)。使うかは経路が決める */
  headers?: Readonly<Record<string, string>>;
};

/** 宛先ごとの送信の結果。kind は sent か失敗の分類(ChannelErrorKind と同じ語彙) */
export type ChannelSendResult =
  | { address: string; kind: "sent"; provider?: string; providerMessageId?: string | null }
  | {
      address: string;
      kind: ChannelErrorKind;
      reason: string;
      message?: string;
      /** 宛先の失効が確定した(この宛先を無効にする)。資格情報・設定・本文の恒久の誤りでは立てない */
      addressInvalid?: boolean;
      provider?: string;
    };

/** provider の webhook の正規化した事件(lib/mail/webhooks の MailWebhookEvent と同じ形。種類は経路が決める) */
export type ChannelWebhookEvent = {
  provider: string;
  providerMessageId: string | null;
  /** 送る時に provider のタグで渡した配達の id(読めなければ null。providerMessageId で引けない時に使う) */
  deliveryId?: string | null;
  providerEventId: string;
  type: string;
  address: string | null;
  occurredAt: Date;
  raw: unknown;
};

/** provider ごとの webhook の検証と正規化(受け口の住所 /api/webhook/messaging/[channel]/[provider]) */
export type ChannelWebhook = {
  /** 生の本文とヘッダを検証する。失敗は投げる。秘密は経路が自分の設定から読む */
  verify: (input: { rawBody: string | Uint8Array; headers: Headers }) => unknown | Promise<unknown>;
  normalize: (verified: unknown) => ChannelWebhookEvent[];
};

/**
 * 経路の項目(messaging/channels/<名前>.ts の export const channel)
 */
export type MessageChannel = {
  /** 経路の鍵(定義の content・defaultChannels の鍵) */
  key: string;
  label: string;
  /** 宛先の決め方: user = 利用者から引く / address = 宛先を直に渡す */
  addressing: "user" | "address";
  /**
   * 経路の入切(既定 true)。false の経路は項目が無い経路と同じ扱い(配達の行は reason channel_off、送らない)。
   * 値は項目が自分の設定から読む(例 line = messaging の config。fork は src/config の上書きで開ける)。門の機能ではない
   */
  enabled?: boolean;
  /** 経路の欄の zod(定義の content.<鍵> の形。生成の一覧で MessageContent に合成される) */
  fields: z.ZodTypeAny;
  /** 他の経路の欄から中身を作る宣言(例 push = inApp の title・body・link)。連絡ごとは定義の extras.<経路> */
  contentFrom?: { channel: string; map: Record<string, string> };
  /** 宛先の解決(既定は端末の帳簿 message_endpoints。email・line は自前の帳簿) */
  resolveAddresses?: (userIds: readonly string[]) => Promise<ChannelAddress[]>;
  /**
   * 端末の帳簿(message_endpoints)に登録できる宛先の形(帳簿を読む経路 = resolveAddresses を持たない経路だけが使う)。
   * address の zod(例 push のトークン・E.164 の電話番号)。登録の口が検査し、通った値(trim などの変換後)を残す。
   * 無ければ汎用の形(1〜2048 文字)だけを見る
   */
  endpoint?: { address: z.ZodType<string, z.ZodTypeDef, unknown> };
  /**
   * 宛先の無い利用者を案内する先(サイト内のパスか URL。例 LINE の連携の入口)。好みの表で宛先の無い経路に出す。
   * 連携の画面が無い経路は持たない
   */
  connectHref?: string;
  /**
   * 描いたプレビュー(管理の送信の確認)。content = 差し込みを済ませた経路の欄。送る時と同じ描き方で描く(例 email = HTML)。
   * 無い経路はプレビューで欄をそのまま見せる
   */
  preview?: (input: {
    messageKey: MessageKey;
    content: unknown;
    /** 好みに従う連絡の種類(あれば停止のリンクの見本を出す) */
    category?: string;
  }) => Promise<{ html?: string; text?: string }>;
  /** 未送信の宛先の束を送る。宛先ごとの結果を返す(投げると束の全部を unknown として扱う) */
  send: (targets: readonly ChannelSendTarget[]) => Promise<ChannelSendResult[]>;
  /** provider → webhook の検証と正規化 */
  webhooks?: Readonly<Record<string, ChannelWebhook>>;
};

// ---------------------------------------------------------------------------
// enrichers: 上流の連絡に値を足す
// ---------------------------------------------------------------------------

/** 値を作るときに渡される文脈 */
export type MessageEnricherContext = {
  messageKey: MessageKey;
  recipient: { userId: string | null; name: string | null; email: string | null };
  /** 呼び手の vars(読むだけ) */
  vars: Readonly<Record<string, unknown>>;
};

/**
 * 値の項目(messaging/enrichers/<名前>.ts の export const enricher)。provides の鍵が {{鍵}} で使える(実行時に zod で検査)
 */
export type MessageEnricher = {
  key: string;
  /** 当てる連絡の鍵("*" = 全部) */
  messages: "*" | readonly MessageKey[];
  /** 足す変数の名前と型(管理画面の変数の候補と保存時の検査が読む) */
  provides: z.AnyZodObject;
  resolve: (context: MessageEnricherContext) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// categories: 配信停止の種類
// ---------------------------------------------------------------------------

/**
 * 種類の項目(messaging/categories/<名前>.ts の export const category)。配信停止の単位 = 種類 × 経路
 */
export type MessageCategory = {
  key: string;
  label: string;
  description?: string;
  /** 基の種別(取引は好みを見ないので種類を持たない) */
  kind: Exclude<MessageKind, "transactional">;
};

// ---------------------------------------------------------------------------
// audiences: 宛先の集め方(管理の送信)
// ---------------------------------------------------------------------------

/** keyset で次の束を引く印 */
export type MessageAudienceCursor = string | null;

/**
 * 宛先の集め方の項目(messaging/audiences/<名前>.ts の export const audience)
 */
export type MessageAudience = {
  key: string;
  label: string;
  /** 管理画面で選ぶ引数 */
  args: z.ZodTypeAny;
  /** 宛先の数(管理の送信の見込み。無ければ resolveUserIds を上限まで数える)。送る時に数え直す */
  count?: (args: unknown) => Promise<number>;
  /** 利用者 id の束を keyset で返す(nextCursor = null で終わり) */
  resolveUserIds: (
    args: unknown,
    cursor: MessageAudienceCursor,
  ) => Promise<{ userIds: string[]; nextCursor: MessageAudienceCursor }>;
};

// ---------------------------------------------------------------------------
// sources: 送り元
// ---------------------------------------------------------------------------

/**
 * 送り元の項目(messaging/sources/<名前>.ts の export const source)。定義から送る連絡は定義の鍵が既定の送り元
 */
export type MessageSource = {
  key: string;
  label: string;
};

// ---------------------------------------------------------------------------
// subscribers: 送った後の購読
// ---------------------------------------------------------------------------

/** 内部の事件と provider の事件の種類 */
export type MessageEventType =
  | "dispatch.completed"
  | "delivery.sent"
  | "delivery.failed"
  | "delivery.suppressed"
  | (string & {});

/** 購読に渡る事件 1 つ */
export type MessageEvent = {
  /** 事件の id(handle はこの id + 購読の鍵で冪等にする) */
  id: string;
  type: MessageEventType;
  messageKey: MessageKey | null;
  /** 事件の回(照合できなかった provider の事件は null) */
  dispatchId: string | null;
  deliveryId: string | null;
  channel: string | null;
  occurredAt: Date;
  payload: Readonly<Record<string, unknown>>;
};

/**
 * 購読の項目(messaging/subscribers/<名前>.ts の export const subscriber)。cron(messaging-subscribers)が入った順に少なくとも 1 回渡す。
 * handle は事件の id で冪等にする(同じ事件が 2 回渡ることがある)。投げると印を進めず、同じ事件が上限の回数失敗すると隔離して先へ進む
 */
export type MessageSubscriber = {
  key: string;
  /** 受ける事件の種類 */
  on: readonly MessageEventType[];
  /** 絞り(連絡の鍵・経路) */
  filter?: { messages?: readonly MessageKey[]; channels?: readonly string[] };
  /** 事件の束を処理する。投げると印を進めず次回もう一度渡る */
  handle: (events: readonly MessageEvent[]) => Promise<void>;
};
