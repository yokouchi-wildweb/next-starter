// src/lib/messaging/receptacles/types.ts
//
// messaging の受け口(src/domains/core/messaging/extensionPoints.ts)の項目の型。
// 項目は messaging/<受け口>/<名前>.ts に export const <単数> = { … } で置き、pnpm generate extensions が一覧にする。
// 送る口・記録・購読の cron(読み手)は連絡のドメインの作り直しの切り替えの区切りで作る。ここは項目の形の約束だけ。

import type { z } from "zod";

import type { ChannelErrorKind } from "../definition/errors";
import type { MessageChannelRendering } from "../layout/rendering";
import type { MessageLayout, MessageLayoutSummary, MessageLayoutValues } from "../layout/types";
import type { MessageKey, MessageKind } from "../definition/types";

// ---------------------------------------------------------------------------
// channels: 送信チャンネル(上流の email・inApp・line も fork の送信チャンネルも同じ形)
// ---------------------------------------------------------------------------

/** 送信チャンネルの宛先 1 つ */
export type ChannelAddress = {
  /** 受信者(利用者が居ない宛先は null) */
  userId: string | null;
  /** 送信チャンネルの中の宛先(メールアドレス・LINE の id・プッシュのトークン。inApp は利用者 id) */
  address: string;
};

/** 送信チャンネルへ渡す 1 宛先分の送信 */
export type ChannelSendTarget = ChannelAddress & {
  /** 連絡の鍵(<ドメイン>.<名前>) */
  messageKey: MessageKey;
  /** 宛先まで含む冪等の鍵(provider の冪等の鍵に渡す) */
  idempotencyKey: string;
  /**
   * その宛先へ組んだ中身({{鍵}} は差し込み済み)。送る時に描く送信チャンネル(rendersAtSend)とレイアウトの描き方で描く送信チャンネルは MessageLayoutContent、
   * ほかは送信チャンネルの汎用の描き方か要約から描いた物(inApp = お知らせの行の title・body・image・link、line = text)
   */
  content: Record<string, unknown>;
  /**
   * 配信停止のカテゴリーの鍵。好みに従う連絡(種別が transactional でなく required でもない)の時だけ入る。
   * 入っている = 受信者が止められる連絡(メールは List-Unsubscribe を付ける)
   */
  category?: string;
  /** 送る側が付ける追加のヘッダ(例 List-Unsubscribe・List-Unsubscribe-Post)。使うかは送信チャンネルが決める */
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

/** provider の webhook の正規化した事件(lib/mail/webhooks の MailWebhookEvent と同じ形。種類は送信チャンネルが決める) */
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
  /** 生の本文とヘッダを検証する。失敗は投げる。秘密は送信チャンネルが自分の設定から読む */
  verify: (input: { rawBody: string | Uint8Array; headers: Headers }) => unknown | Promise<unknown>;
  normalize: (verified: unknown) => ChannelWebhookEvent[];
};

/** 送信チャンネルが描いた物(email = HTML、inApp = お知らせの行の中身、line = 本文の文) */
export type ChannelRendered = { html?: string; text?: string; content?: Record<string, unknown> };

/**
 * 送信チャンネルの項目(messaging/channels/<名前>.ts の export const channel)。
 * レイアウトの描き方の 3 段(D124)の宣言 MessageChannelRendering を任意で持つ: renderGeneric(欄の型とブロックを宣言の順に描く)・
 * genericFieldTypes(描ける型、無い = 全部)・summaryRenderable + renderFromSummary(要約から描ける)。送信チャンネルは自分の欄を持たない(中身はレイアウト、D122)
 */
export type MessageChannel = MessageChannelRendering<ChannelRendered> & {
  /** 送信チャンネルの鍵(カテゴリーの channels の鍵) */
  key: string;
  label: string;
  /** 宛先の決め方: user = 利用者から引く / address = 宛先を直に渡す */
  addressing: "user" | "address";
  /**
   * 送信チャンネルの入切(既定 true)。false の送信チャンネルは項目が無い送信チャンネルと同じ扱い(配達の行は reason channel_off、送らない)。
   * 値は項目が自分の設定から読む(例 line = messaging の config。fork は src/config の上書きで開ける)。門の機能ではない
   */
  enabled?: boolean;
  /** 宛先の解決(既定は端末の帳簿 message_endpoints。email・line は自前の帳簿) */
  resolveAddresses?: (userIds: readonly string[]) => Promise<ChannelAddress[]>;
  /**
   * 端末の帳簿(message_endpoints)に登録できる宛先の形(帳簿を読む送信チャンネル = resolveAddresses を持たない送信チャンネルだけが使う)。
   * address の zod(例 push のトークン・E.164 の電話番号)。登録の口が検査し、通った値(trim などの変換後)を残す。
   * 無ければ汎用の形(1〜2048 文字)だけを見る
   */
  endpoint?: { address: z.ZodType<string, z.ZodTypeDef, unknown> };
  /**
   * 宛先の無い利用者を案内する先(サイト内のパスか URL。例 LINE の連携の入口)。好みの表で宛先の無い送信チャンネルに出す。
   * 連携の画面が無い送信チャンネルは持たない
   */
  connectHref?: string;
  /**
   * 描いたプレビュー(管理の送信の確認)。content = 送る時と同じ組み立ての中身(ChannelSendTarget.content と同じ)。送る時と同じ描き方で描く(例 email = HTML)。
   * 無い送信チャンネルはプレビューで欄をそのまま見せる
   */
  preview?: (input: {
    messageKey: MessageKey;
    content: unknown;
    /** 好みに従う連絡のカテゴリー(あれば停止のリンクの見本を出す) */
    category?: string;
  }) => Promise<{ html?: string; text?: string }>;
  /**
   * 届けた物を取り下げる(任意、D89)。管理の「削除」が送信を消す時に呼ぶ(例 inApp = 受け取り箱の行・共有の行・画像)。
   * 持つ送信チャンネル = 消せる送信チャンネル(removable)。持たない送信チャンネル(email・line など)の届けた物はそのまま残る。
   * 何度呼んでも同じ結果になるように書く(消す途中で落ちた送信はもう一度削除すると呼び直す)
   */
  remove?: (input: { dispatchId: string }) => Promise<{ removed: number }>;
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
 * enricher の当て先(D127)。どれかに当たる連絡に当てる(OR)。all: true = 全部の連絡
 * - messages: 連絡の鍵 / categories: カテゴリーの鍵 / kinds: 種別(管理者が書いて送る連絡は種別 announcement・direct・promotion で当てる)
 */
export type MessageEnricherTarget = {
  messages?: readonly MessageKey[];
  categories?: readonly string[];
  kinds?: readonly MessageKind[];
  all?: true;
};

/** 管理画面に出すカテゴリーの名前(adminLabel、無ければ label。D124) */
export function categoryAdminLabel(category: Pick<MessageCategory, "label" | "adminLabel">): string {
  return category.adminLabel ?? category.label;
}

/** 当て先がその連絡に当たるか */
export function enricherTargets(
  target: MessageEnricherTarget,
  message: { key: string; category: string; kind: MessageKind },
): boolean {
  if (target.all) return true;
  return Boolean(
    target.messages?.some((key) => key === message.key) ||
      target.categories?.includes(message.category) ||
      target.kinds?.includes(message.kind),
  );
}

/**
 * 値の項目(messaging/enrichers/<名前>.ts の export const enricher)。provides の鍵が {{鍵}} で使える(実行時に zod で検査)
 */
export type MessageEnricher = {
  key: string;
  /** 当て先(連絡の鍵・カテゴリー・種別・全部、D127)。使える鍵の検査と実行がこの当て先で選ぶ */
  target: MessageEnricherTarget;
  /** 足す変数の名前と型(管理画面の変数の候補と保存時の検査が読む) */
  provides: z.AnyZodObject;
  /**
   * 足す値ごとの日本語の別名(provides の鍵 → 別名、全部の鍵に要る、D126)。文面に {{鍵}} でも {{別名}} でも書ける。
   * 別名は共通の埋め込み情報・テンプレートの専用の名前と重ならない(vars/catalog.ts の checkVarCatalog)
   */
  aliases: Readonly<Record<string, string>>;
  resolve: (context: MessageEnricherContext) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// categories: 配信停止のカテゴリー
// ---------------------------------------------------------------------------

/**
 * カテゴリーの項目(messaging/categories/<名前>.ts の export const category)。
 * カテゴリー = 利用者から見て 1 つの出来事(D79)。種別と送信チャンネルを持ち、属する連絡は全部この送信チャンネルで届く(D86)。配信停止の単位 = カテゴリー × 送信チャンネル。
 * fork は上流のカテゴリーの隣の <名前>.override.ts で label・description・channels・group を変えられる(key・kind は不可。
 * functional・security の email は外せない)
 */
export type MessageCategory = {
  key: string;
  /** 利用者に見せる名前(好みの設定・配信停止・受け取り箱) */
  label: string;
  /** 管理画面の名前(送る・テンプレート・テキストの編集・送信の画面、D124)。無い = label */
  adminLabel?: string;
  description?: string;
  /** 種別(7 つ。性質は MESSAGE_KIND_TRAITS) */
  kind: MessageKind;
  /** 届ける送信チャンネル(送信チャンネルの受け口の鍵) */
  channels: readonly string[];
  /**
   * 管理の送る画面で最初に入っている送信チャンネル(channels の中、1 つ以上。無い = channels の全部)。送る時の絞りの初めの値だけで、
   * 停止の単位・届けられる送信チャンネルは channels のまま(D119)
   */
  defaultChannels?: readonly string[];
  /** 設定画面の見出しのグループ(categoryGroups の鍵。同じ種別のカテゴリーだけ、D82) */
  group?: string;
};

/**
 * カテゴリーのグループの項目(messaging/categoryGroups/<名前>.ts の export const group)。設定画面の見出しだけ(停止の単位ではない、D82)。上流は出荷しない
 */
export type MessageCategoryGroup = {
  key: string;
  label: string;
  /** 並び順(小さいほど先) */
  order: number;
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
  /** 事件の送信(照合できなかった provider の事件は null) */
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
  /** 絞り(連絡の鍵・送信チャンネル) */
  filter?: { messages?: readonly MessageKey[]; channels?: readonly string[] };
  /** 事件の束を処理する。投げると印を進めず次回もう一度渡る */
  handle: (events: readonly MessageEvent[]) => Promise<void>;
};

// ---------------------------------------------------------------------------
// layouts: レイアウト(D122)。layouts/<名前>/ のフォルダ 1 つが 1 つのレイアウト
// ---------------------------------------------------------------------------

/** レイアウトの宣言(layouts/<名前>/layout.ts の export const layout)。folder = レイアウトのフォルダの名前(生成の一覧が付ける) */
export type MessageLayoutItem = MessageLayout & { folder?: string };

/**
 * メールの描き方(layouts/<名前>/email.tsx の export const emailRenderer、server)。layout = レイアウトの鍵。
 * Component は 1 行スイッチ(<部品>.tsx → <部品>.default.tsx)にしておくと fork が .replace で見た目だけ替えられる。
 * 色の型はメールの部品の lib が決めるので never(どの色の型の部品も受ける)
 */
export type MessageLayoutEmailRenderer = {
  layout: string;
  /** レイアウトのフォルダの名前(生成の一覧が付ける) */
  folder?: string;
  Component: (props: { values: MessageLayoutValues; summary: MessageLayoutSummary; theme: never; unsubscribeUrl?: string }) => unknown;
};

/** お知らせの描き方(layouts/<名前>/inApp.tsx の export const inAppRenderer、client)。layout = レイアウトの鍵 */
export type MessageLayoutInAppRenderer = {
  layout: string;
  /** レイアウトのフォルダの名前(生成の一覧が付ける) */
  folder?: string;
  Component: (props: { values: MessageLayoutValues; summary: MessageLayoutSummary }) => unknown;
};
