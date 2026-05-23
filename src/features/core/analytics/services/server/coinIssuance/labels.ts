// src/features/core/analytics/services/server/coinIssuance/labels.ts
// コイン創出ソースの表示ラベルレジストリ。
//
// CoinIssuanceSource.key は機械可読な snake_case (例: "purchase_bonus_gap") なので、
// 管理画面で表示する際は人間可読なラベルへ変換する必要がある。
// このレジストリで key → 表示名 のマッピングを一元管理する。
//
// 設計方針:
//  - upstream の組み込みソースには初期ラベルを登録しておく
//  - downstream は registerCoinIssuanceLabels で自分のソースのラベルを追加する
//  - 監査ログの registerActionLabels と同じ運用パターン (CLAUDE.md 参照)
//  - 多言語化が必要になったら、このレジストリをロケール別に拡張する
//
// クライアント側 / サーバー側のどちらからも import 可能 (純粋な Map 操作のため)。

const labels = new Map<string, string>();

/**
 * ソース key と表示ラベルのマッピングを登録する。
 *
 * 同一 key を上書きで再登録できる (downstream が upstream ラベルを差し替える用途)。
 *
 * @example
 * registerCoinIssuanceLabels({
 *   gacha_profit: "ガチャ収支",
 *   winning_report_reward: "当選報告特典",
 * });
 */
export function registerCoinIssuanceLabels(
  entries: Record<string, string>,
): void {
  for (const [key, label] of Object.entries(entries)) {
    labels.set(key, label);
  }
}

/**
 * ソース key のラベルを取得する。
 *
 * 未登録の場合は key そのものを返す (UI で空にしないためのフォールバック)。
 * 必要なら呼び出し側で `getCoinIssuanceLabel(key) === key` で未登録判定可能。
 */
export function getCoinIssuanceLabel(key: string): string {
  return labels.get(key) ?? key;
}

/**
 * 登録済みのラベル全件を Record で取得する (UI 一覧表示等で利用)。
 */
export function getAllCoinIssuanceLabels(): Record<string, string> {
  return Object.fromEntries(labels);
}

// ============================================================================
// upstream 組み込みソースのデフォルトラベル
// ============================================================================
//
// upstream で確実に登録されるソース (purchaseBonusGap / referralReward) のラベルは
// 最初から登録しておく。downstream は registerCoinIssuanceLabels を必要に応じて
// 追加で呼べばよい。

registerCoinIssuanceLabels({
  // コイン購入時にサービス側が負担した上乗せボーナス全般
  // (クーポン割引 / ユーザーランクボーナス / 決済方法ボーナス / 購入パッケージのボーナス)
  purchase_bonus_gap: "購入時ボーナス発行",
  referral_reward: "紹介リワード",
});
