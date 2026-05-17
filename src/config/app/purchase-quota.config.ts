// src/config/app/purchase-quota.config.ts

/**
 * 購入クォータルール設定。
 *
 * 1 ユーザーが特定の期間内に購入できる金額上限を宣言する。
 * - 配列が空 (デフォルト) のときは完全に無効 (既存挙動と同一)。
 * - 複数ルールを並列で評価し、いずれかが超過すれば購入をブロックする。
 *
 * 使い方:
 *   下流プロジェクトで本ファイルの PURCHASE_QUOTA_RULES に必要なルールを追加するだけ。
 *   DB マイグレーションや再ビルドは不要 (デプロイ時に自動反映)。
 */

/**
 * ルールが適用される範囲。
 * - paymentMethod: 特定の決済方法のみ集計対象
 * - all: 全決済方法を合算
 */
export type QuotaScope =
  | { type: "paymentMethod"; value: string }
  | { type: "all" };

/**
 * 個別ルール定義。
 *
 * - key: ルール識別子。監査ログ・エラーで使う安定識別子のため、本番投入後に変更しない。
 * - label: ユーザー向け表示・管理画面表示の文字列。
 * - scope: 集計対象スコープ。
 * - windowSeconds: 集計対象期間 (秒)。例: 3600=1h, 86400=24h。
 * - maxAmount: 上限金額 (円)。集計値がこの値を超えるとブロック。
 */
export type QuotaRule = {
  key: string;
  label: string;
  scope: QuotaScope;
  windowSeconds: number;
  maxAmount: number;
};

/**
 * 適用されるクォータルール一覧。
 *
 * デフォルト = 空配列 = クォータ無効 (既存稼働プロジェクトはゼロインパクト)。
 *
 * 設定例:
 * ```ts
 * export const PURCHASE_QUOTA_RULES: readonly QuotaRule[] = [
 *   {
 *     key: "bank_transfer_hourly",
 *     label: "銀行振込: 1時間30万円",
 *     scope: { type: "paymentMethod", value: "bank_transfer" },
 *     windowSeconds: 3600,
 *     maxAmount: 300_000,
 *   },
 *   {
 *     key: "all_daily",
 *     label: "全決済: 1日100万円",
 *     scope: { type: "all" },
 *     windowSeconds: 86400,
 *     maxAmount: 1_000_000,
 *   },
 * ];
 * ```
 */
export const PURCHASE_QUOTA_RULES: readonly QuotaRule[] = [];

/**
 * 台帳のクリーンアップ保持期間 (日)。
 *
 * windowSeconds 最大値より長い期間を指定すること。
 * 監査・調査目的で短くしすぎないことを推奨 (デフォルト 90 日)。
 */
export const PURCHASE_QUOTA_LEDGER_RETENTION_DAYS = 90;
