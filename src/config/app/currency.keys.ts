// src/config/app/currency.keys.ts
// DB/drizzle 用のウォレット種別キー定義（React/JSX 依存なし）
// ※ drizzle-kit が esbuild でバンドルする際に .tsx が含まれないよう分離

/**
 * ウォレット種別のキー一覧
 * currency.config.ts のキーと一致させること
 *
 * [!!] 通貨の追加・削除時はこのファイルと currency.config.ts の両方を更新すること
 */
export const WALLET_TYPE_KEYS = [
  "regular_coin",
  "regular_point",
] as const;

/**
 * ウォレット種別の型
 */
export type WalletType = (typeof WALLET_TYPE_KEYS)[number];
