// src/lib/messaging/receptacles/types.ts
//
// messaging の受け口(src/features/core/messaging/extensionPoints.ts)の項目の型。
// 項目は messaging/<受け口>/<名前>.ts に export const <単数> = { … } で置き、pnpm generate extensions が一覧にする。
// 送る口・記録・購読の cron(読み手)は連絡のドメインの作り直しの切り替えの区切りで作る。ここは項目の形の約束だけ。

import type { z } from "zod";

import type { ChannelErrorKind } from "../definition/errors";
import type { MessageChannelRendering } from "../layout/rendering";
import type { MessageLayout, MessageLayoutSummary, MessageLayoutValues } from "../layout/types";
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
  /** 連絡の鍵(<ドメイン>.<名前>) */
  messageKey: MessageKey;
  /** 宛先まで含む冪等の鍵(provider の冪等の鍵に渡す) */
  idempotencyKey: string;
  /**
   * その宛先へ組んだ中身({{鍵}} は差し込み済み)。送る時に描く経路(rendersAtSend)とひな形の描き方で描く経路は MessageLayoutContent、
   * ほかは経路の汎用の描き方か要約から描いた物(inApp = お知らせの行の title・body・image・link、line = text)
   */
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

/** 欄の入力の種類(管理画面の文言の編集が欄ごとに描く入力) */
export type ChannelFieldInput = "line" | "text" | "image" | "url" | "select";

/**
 * 経路の欄 1 つの表示の約束(D83)。管理画面(文言の編集・テンプレート)が欄の見出し・説明・入力の種類を読む。
 * - line = 1 行の文字 / text = 複数行の文字 / image = 画像(storage:// の参照か URL)/ url = 行き先 / select = options から選ぶ
 * - list: true = 値が並び(例 メールの段落 string[]。input は並びの 1 つの入力)
 * - parts = 値が object(例 メールのボタン { label, url })。鍵ごとの約束(input は parts の無い時の既定の描き方に使わない)
 */
export type ChannelFieldMeta = {
  label: string;
  help?: string;
  input: ChannelFieldInput;
  /** input select の選択肢 */
  options?: readonly { value: string; label: string }[];
  list?: true;
  parts?: Readonly<Record<string, ChannelFieldMeta>>;
};

/** 経路が描いた物(email = HTML、inApp = お知らせの行の中身、line = 本文の文) */
export type ChannelRendered = { html?: string; text?: string; content?: Record<string, unknown> };

/**
 * 経路の項目(messaging/channels/<名前>.ts の export const channel)。
 * ひな形の描き方の 3 段(D124)の宣言 MessageChannelRendering を任意で持つ: renderGeneric(欄の型とブロックを宣言の順に描く)・
 * genericFieldTypes(描ける型、無い = 全部)・summaryRenderable + renderFromSummary(要約から描ける)。fields / fieldMeta は今の送る口のまま
 */
export type MessageChannel = MessageChannelRendering<ChannelRendered> & {
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
  /** 経路の欄の zod(管理画面の文言の編集・テンプレートの文面の形。送る口は読まない、S5 で消す) */
  fields: z.ZodTypeAny;
  /**
   * 欄ごとの表示の約束(D83、必須)。鍵 = fields の欄の名前。管理画面の文言の編集は経路の欄を全部この順で出す
   * (約束の無い欄は欄の名前を見出しに 1 行の入力で出す)
   */
  fieldMeta: Readonly<Record<string, ChannelFieldMeta>>;
  /**
   * 管理画面のプレビューの部品の鍵(任意、D83)。画面が自分の部品の表から引く(client の部品は server の項目に置けないため鍵で渡す)。
   * 無い・画面が知らない鍵 = 欄をそのまま見せる
   */
  previewComponent?: string;
  /** 他の経路の欄から中身を作る宣言(例 push = inApp の title・body・link)。送る口はもう読まない(中身はひな形の 3 段で組む)。S5 で消す */
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
   * 描いたプレビュー(管理の送信の確認)。content = 送る時と同じ組み立ての中身(ChannelSendTarget.content と同じ)。送る時と同じ描き方で描く(例 email = HTML)。
   * 無い経路はプレビューで欄をそのまま見せる
   */
  preview?: (input: {
    messageKey: MessageKey;
    content: unknown;
    /** 好みに従う連絡の種類(あれば停止のリンクの見本を出す) */
    category?: string;
  }) => Promise<{ html?: string; text?: string }>;
  /**
   * 届けた物を取り下げる(任意、D89)。管理の「削除」が回を消す時に呼ぶ(例 inApp = 受け取り箱の行・共有の行・画像)。
   * 持つ経路 = 消せる経路(removable)。持たない経路(email・line など)の届けた物はそのまま残る。
   * 何度呼んでも同じ結果になるように書く(消す途中で落ちた回はもう一度削除すると呼び直す)
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
 * - messages: 連絡の鍵 / categories: 種類の鍵 / kinds: 種別(管理者が書いて送る連絡は種別 announcement・direct・promotion で当てる)
 */
export type MessageEnricherTarget = {
  messages?: readonly MessageKey[];
  categories?: readonly string[];
  kinds?: readonly MessageKind[];
  all?: true;
};

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
  /** 当て先(連絡の鍵・種類・種別・全部、D127)。使える鍵の検査と実行がこの当て先で選ぶ */
  target: MessageEnricherTarget;
  /** 足す変数の名前と型(管理画面の変数の候補と保存時の検査が読む) */
  provides: z.AnyZodObject;
  resolve: (context: MessageEnricherContext) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// categories: 配信停止の種類
// ---------------------------------------------------------------------------

/**
 * 種類の項目(messaging/categories/<名前>.ts の export const category)。
 * 種類 = 利用者から見て 1 つの出来事(D79)。種別と経路を持ち、属する連絡は全部この経路で届く(D86)。配信停止の単位 = 種類 × 経路。
 * fork は上流の種類の隣の <名前>.override.ts で label・description・channels・group を変えられる(key・kind は不可。
 * functional・security の email は外せない)
 */
export type MessageCategory = {
  key: string;
  label: string;
  description?: string;
  /** 種別(7 つ。性質は MESSAGE_KIND_TRAITS) */
  kind: MessageKind;
  /** 届ける経路(経路の受け口の鍵) */
  channels: readonly string[];
  /** 設定画面の見出しのグループ(categoryGroups の鍵。同じ種別の種類だけ、D82) */
  group?: string;
};

/**
 * 種類のグループの項目(messaging/categoryGroups/<名前>.ts の export const group)。設定画面の見出しだけ(停止の単位ではない、D82)。上流は出荷しない
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

// ---------------------------------------------------------------------------
// systemTemplates: システムテンプレート(D117・D125)。管理の送信の白紙、種別ごとに 1 つ
// ---------------------------------------------------------------------------

/**
 * システムテンプレート(messaging/templates/<名前>.ts の export const systemTemplate)。管理者がその場で書く送信も fork のコードからの管理の送信も
 * この白紙(か DB のテンプレート)から書く。管理画面で直せない・消せない(テンプレートの一覧に印つきで並ぶ)。fork は <名前>.override.ts で label だけ変えられる
 */
export type MessageSystemTemplate = {
  /** 鍵(回の system_template に残す。英数字の camelCase) */
  key: string;
  /** 種別(管理者がその場で送れる種別 = 種別の性質 adminFreeText がある物。種別ごとに 1 つ) */
  kind: MessageKind;
  /** 管理画面に出す名前 */
  label: string;
  /** ひな形の鍵(layouts の受け口) */
  layout: string;
  /** 白紙の欄の中身(ひな形の欄の zod を通る形。送る時は管理者が書いた中身に替わる) */
  values: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// layouts: ひな形(D122)。layouts/<名前>/ のフォルダ 1 つが 1 つのひな形
// ---------------------------------------------------------------------------

/** ひな形の宣言(layouts/<名前>/layout.ts の export const layout)。folder = ひな形のフォルダの名前(生成の一覧が付ける) */
export type MessageLayoutItem = MessageLayout & { folder?: string };

/**
 * メールの描き方(layouts/<名前>/email.tsx の export const emailRenderer、server)。layout = ひな形の鍵。
 * Component は 1 行スイッチ(<部品>.tsx → <部品>.default.tsx)にしておくと fork が .replace で見た目だけ替えられる。
 * 色の型はメールの部品の lib が決めるので never(どの色の型の部品も受ける)
 */
export type MessageLayoutEmailRenderer = {
  layout: string;
  /** ひな形のフォルダの名前(生成の一覧が付ける) */
  folder?: string;
  Component: (props: { values: MessageLayoutValues; summary: MessageLayoutSummary; theme: never; unsubscribeUrl?: string }) => unknown;
};

/** お知らせの描き方(layouts/<名前>/inApp.tsx の export const inAppRenderer、client)。layout = ひな形の鍵 */
export type MessageLayoutInAppRenderer = {
  layout: string;
  /** ひな形のフォルダの名前(生成の一覧が付ける) */
  folder?: string;
  Component: (props: { values: MessageLayoutValues; summary: MessageLayoutSummary }) => unknown;
};
