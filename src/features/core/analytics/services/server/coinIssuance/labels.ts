// src/features/core/analytics/services/server/coinIssuance/labels.ts
// コイン創出ソースの表示ラベルの読み手(値は src/config/app/coin-issuance.config.ts)。
// CoinIssuanceSource.key は機械可読な snake_case なので、管理画面で表示するときに人間可読なラベルへ変換する。
// クライアント側 / サーバー側のどちらからも import 可能。

import { COIN_ISSUANCE_LABELS } from "@/config/app/coin-issuance.config";

/**
 * ソース key のラベルを取得する。
 *
 * 未定義の場合は key そのものを返す (UI で空にしないためのフォールバック)。
 * 必要なら呼び出し側で `getCoinIssuanceLabel(key) === key` で未定義を判定可能。
 */
export function getCoinIssuanceLabel(key: string): string {
  return COIN_ISSUANCE_LABELS[key] ?? key;
}

/**
 * ラベル全件を Record で取得する (UI 一覧表示等で利用)。
 */
export function getAllCoinIssuanceLabels(): Record<string, string> {
  return { ...COIN_ISSUANCE_LABELS };
}
