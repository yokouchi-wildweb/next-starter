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

import type { WalletType } from "./currency.config";

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
};

/**
 * ウォレット有効期限設定マップ
 * キー = walletType（currency.config.ts と同一キー）
 *
 * ダウンストリームでの有効化例:
 *   regular_coin: { expirationDays: 180, sweepEnabled: true },
 */
export const WALLET_EXPIRATION_CONFIG: Record<WalletType, WalletExpirationConfig> = {
  regular_coin: { expirationDays: null, sweepEnabled: false },
  regular_point: { expirationDays: null, sweepEnabled: false },
};

/**
 * 消費し尽くしたロット（remaining = 0）を物理削除するまでの保持日数。
 * ロットは会計上の現在状態であり、履歴は wallet_histories が持つため長期保持は不要。
 * 付与頻度が高いプロジェクトでは wallet_lots の肥大化を防ぐため
 * wallet-lots-prune cron（日次推奨）とセットで運用する。
 */
export const WALLET_LOT_PRUNE_RETENTION_DAYS = 30;
