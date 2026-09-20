// src/config/app/wallet-expiration.config.ts
// ウォレット有効期限（ロット管理）の設定ファイル
// ※ダウンストリームで編集対象：失効させたい通貨の値を書き換えるだけで有効化できる
//
// デフォルトは全通貨で無効（expirationDays: null）。
// 無効な通貨はロット（wallet_lots）への書き込みが一切発生せず、既存挙動と完全に同一。
//
// [!!] 有効化手順（必ず順番に実行すること）:
//   1. 対象通貨の expirationDays に日数を設定（例: 180）
//   2. `pnpm task wallet-lots-init` を1回実行
//      （既存残高を「実行日取得扱い」の初期ロット1本に変換する。これを忘れると消費時にエラーになる）
//   3. スケジューラに wallet-expire-lots を登録（推奨: 日次深夜帯）
// 詳細: src/features/core/wallet/README.md

//
// 失効通知（予告・本通知）もこのファイルで通貨ごとに設定する（デフォルトは全て送らない）。
// 文言だけ変えたい場合は「通知の文面」ブロックの文字列を編集すればよい（ロジックに触れる必要はない）。

import type { WalletType } from "./currency.config";

/** 通知チャネル（語彙は messaging ドメインの MessagingChannel と同じ） */
export type WalletExpirationNoticeChannel = "email" | "inApp";

/**
 * 通知の文面。{{名前}} のプレースホルダが送信時に差し込まれる。
 * channels に含めないチャネルの文面は使われない。
 */
export type WalletExpirationNoticeCopy = {
  emailSubject: string;
  emailBody: string;
  notificationTitle: string;
  notificationBody: string;
};

/** 失効予告の1段（「何日前に・どのチャネルで・どの文面を」送るか） */
export type WalletPreExpiryNoticeStage = {
  /** 失効の何日前に送るか（1以上の整数。同一通貨内で重複不可） */
  daysBefore: number;
  channels: WalletExpirationNoticeChannel[];
  copy: WalletExpirationNoticeCopy;
};

/** 失効時の本通知 */
export type WalletExpiredNotice = {
  channels: WalletExpirationNoticeChannel[];
  copy: WalletExpirationNoticeCopy;
};

export type WalletExpirationNoticeConfig = {
  /**
   * 失効予告。空配列 = 予告なし。複数段（例: 30日前と7日前）を並べられる。
   * sweepEnabled: true の通貨でのみ送信される（没収しないのに「失効します」と告げないため）。
   */
  preExpiry: WalletPreExpiryNoticeStage[];
  /** 失効時（没収後）の本通知。null = 本通知なし */
  expired: WalletExpiredNotice | null;
};

// ---------------------------------------------------------------------------
// 通知の文面（ダウンストリームで編集対象）
// ---------------------------------------------------------------------------
// 共通プレースホルダ:
//   {{currencyLabel}} 通貨名（currency.config の label）
//   {{amount}}        対象額（単位付き。例: "1,000 コイン"）
// 失効予告のみ:
//   {{expiresOn}}     失効日（例: "2026年10月1日"。対象が複数ロットなら最も早い失効日）
//   {{daysBefore}}    その段の daysBefore
// 本通知のみ:
//   {{expiredOn}}     失効処理日
//   {{balanceAfter}}  失効後の残高（単位付き）
//
// 段ごと・通貨ごとに文面を変えたい場合は、同じ形の定数を増やして copy に指定する。

/** 失効予告の文面（最小限。ダウンストリームで調整する） */
export const WALLET_PRE_EXPIRY_NOTICE_COPY: WalletExpirationNoticeCopy = {
  emailSubject: "{{currencyLabel}}の有効期限が近づいています",
  emailBody:
    "{{amount}} が {{expiresOn}} に有効期限を迎えます。\n期限を過ぎた分は失効しますので、お早めにご利用ください。",
  notificationTitle: "{{currencyLabel}}の有効期限が近づいています",
  notificationBody: "{{amount}} が {{expiresOn}} に失効します。",
};

/** 失効時の本通知の文面（最小限。ダウンストリームで調整する） */
export const WALLET_EXPIRED_NOTICE_COPY: WalletExpirationNoticeCopy = {
  emailSubject: "{{currencyLabel}}が失効しました",
  emailBody:
    "有効期限切れにより {{amount}} が失効しました。\n失効後の残高: {{balanceAfter}}",
  notificationTitle: "{{currencyLabel}}が失効しました",
  notificationBody: "有効期限切れにより {{amount}} が失効しました。（残高: {{balanceAfter}}）",
};

/**
 * 通貨種別ごとの有効期限設定
 */
export type WalletExpirationConfig = {
  /**
   * 取得（付与）から失効までの日数。
   * null = この通貨は有効期限なし（ロット管理そのものが無効）
   */
  expirationDays: number | null;
  /**
   * 失効スイープ（実際の残高没収）を実行するか。
   * false にすると、ロット記録と失効間近照会は動くが没収は行われない
   * （告知期間中だけ記録を先行させたい場合に使用）。
   * expirationDays が null の場合は無意味。
   */
  sweepEnabled: boolean;
  /**
   * 失効通知の設定。省略 = 予告も本通知も送らない。
   * 送信は wallet-expiration-notice cron が行う（スケジューラ登録が必要）。
   */
  notice?: WalletExpirationNoticeConfig;
};

/**
 * ウォレット有効期限設定マップ
 * キー = walletType（currency.config.ts と同一キー）
 *
 * ダウンストリームでの有効化例:
 *   regular_coin: { expirationDays: 180, sweepEnabled: true },
 *
 * 通知も送る例（30日前はメールのみ、7日前と失効時は両方）:
 *   regular_coin: {
 *     expirationDays: 180,
 *     sweepEnabled: true,
 *     notice: {
 *       preExpiry: [
 *         { daysBefore: 30, channels: ["email"], copy: WALLET_PRE_EXPIRY_NOTICE_COPY },
 *         { daysBefore: 7, channels: ["email", "inApp"], copy: WALLET_PRE_EXPIRY_NOTICE_COPY },
 *       ],
 *       expired: { channels: ["email", "inApp"], copy: WALLET_EXPIRED_NOTICE_COPY },
 *     },
 *   },
 */
export const WALLET_EXPIRATION_CONFIG: Record<WalletType, WalletExpirationConfig> = {
  regular_coin: { expirationDays: null, sweepEnabled: false },
  regular_point: { expirationDays: null, sweepEnabled: false },
};

/**
 * 失効通知の全体設定（通貨によらない）
 */
export const WALLET_EXPIRATION_NOTICE_SETTINGS = {
  /**
   * 通知を送るユーザーステータス。ここに無いステータス（退会・停止・仮登録など）には送らない。
   * 語彙は users.status と同じ。
   */
  targetStatuses: ["active", "inactive"] as readonly string[],
  /**
   * 同時に送信する件数。1 = 1件ずつ順番に送る。
   * 送信量が多くメール基盤の流量制限に余裕があるプロジェクトだけ上げる。
   */
  sendConcurrency: 1,
  /** 文面の日付（{{expiresOn}} / {{expiredOn}}）を表示するタイムゾーン */
  dateTimeZone: "Asia/Tokyo",
};

/**
 * 消費し尽くしたロット（remaining = 0）を物理削除するまでの保持日数。
 * ロットは会計上の現在状態であり、履歴は wallet_histories が持つため長期保持は不要。
 * 付与頻度が高いプロジェクトでは wallet_lots の肥大化を防ぐため
 * wallet-lots-prune cron（日次推奨）とセットで運用する。
 */
export const WALLET_LOT_PRUNE_RETENTION_DAYS = 30;
