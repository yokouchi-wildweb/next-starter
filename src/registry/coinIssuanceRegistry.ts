// src/registry/coinIssuanceRegistry.ts
// 統合コイン創出サマリー (GET /api/admin/analytics/coin-issuance/summary) の
// 集計ソースレジストリ。
//
// このレジストリに登録された CoinIssuanceSource が aggregator から並列実行され、
// kind に応じて revenue (加算) / issuance (減算) として finalProfit に寄与する。
//
// 設計思想:
//  - upstream は確実に存在するドメインのソース (purchaseBonusGap / referralReward) のみを
//    最初から登録しておく
//  - downstream は自分のドメインのソース (gachaProfit / winningReportReward 等) を
//    この配列に追加することで、upstream の集計 API がそのままそれを含める
//  - 「最終収支の定義は upstream で一元化、個別ソースは各ドメインの責務」が原則
//
// downstream で source を追加する手順:
//   1. src/features/<domain>/analytics/coinIssuance/sources/<name>.ts に CoinIssuanceSource
//      を満たす値を定義する (or 既存の analytics ディレクトリに置く)
//   2. このファイルにインポートと配列追加を 1 行ずつ加える
//   3. (任意) src/features/core/analytics/services/server/coinIssuance/labels.ts の
//      registerCoinIssuanceLabels で表示名を登録する
//
// 詳細な実装ガイドは src/features/core/analytics/README.md の
// 「コイン創出サマリーへの参加方法」セクションを参照。

import { purchaseBonusGapSource } from "@/features/core/analytics/services/server/coinIssuance/sources/purchaseBonusGap";
import { referralRewardSource } from "@/features/core/analytics/services/server/coinIssuance/sources/referralReward";

import type { CoinIssuanceSource } from "@/features/core/analytics/services/server/coinIssuance/types";

/**
 * 登録済みのコイン創出ソース一覧。
 *
 * 配列の登録順がそのまま並列実行時のリスト順 / レスポンスの sources エントリ順になる。
 * (Object.fromEntries は挿入順を保持するため、UI 側の表示順制御に利用できる)
 *
 * 注意:
 *  - key の重複は実行時に検知されない。CoinIssuanceSource.key を一意に設計すること
 *    (upstream のキーと衝突しない命名: 例 "gacha_profit", "winning_report_reward")
 */
export const coinIssuanceSources: CoinIssuanceSource[] = [
  // --- CORE (upstream-provided) ---
  purchaseBonusGapSource,
  referralRewardSource,

  // --- DOWNSTREAM (downstream で追加) ---
  // 例: gachaProfitSource, winningReportRewardSource, winningCommentRewardSource, ...
];
