// src/registry/analyticsRollupRegistry.ts
// 日次メトリクス事前集計（ロールアップ）のメトリクスレジストリ。
//
// ここに登録された RollupMetricConfig が以下の対象になる:
//  - 日次 cron: pnpm task analytics-rollup-daily（昨日 + 直近ギャップの自己修復）
//  - バックフィル: pnpm task analytics-rollup-backfill -- <metricKey> [--from --to]
//  - 読み取り: readRolledDailySeries（確定日 = ロールアップ、当日 = ライブ計算をマージ）
//
// 設計思想:
//  - upstream は組み込みメトリクスを登録しない（重い集計はドメイン固有のため）。
//    フレームワーク（保存・cron・マージ）が upstream、メトリクス定義は downstream の責務
//  - ロールアップ行はソーステーブルから再計算可能な派生キャッシュ。
//    集計除外等でソースの解釈が遡及的に変わったら、該当期間のバックフィルを再実行する
//
// downstream でメトリクスを追加する手順:
//   1. src/features/<domain>/analytics/rollup/<name>.ts に RollupMetricConfig を定義する
//      （集計除外の適用は compute 内部の責務）
//   2. このファイルにインポートと配列追加を 1 行ずつ加える
//   3. バックフィルを実行する: pnpm task analytics-rollup-backfill -- <metricKey>
//
// 詳細な実装ガイドは src/features/core/analytics/README.md の
// 「日次ロールアップ（事前集計）フレームワーク」セクションを参照。

import type { RollupMetricConfig } from "@/features/core/analytics/services/server/rollup/types";

/**
 * 登録済みのロールアップメトリクス一覧。
 *
 * key はレジストリ内で一意であること（重複は実行時に DomainError）。
 */
export const analyticsRollupMetrics: RollupMetricConfig[] = [
  // --- CORE (upstream-provided): なし ---

  // --- DOWNSTREAM (downstream で追加) ---
  // 例: walletClosingBalanceMetric, gachaDailyProfitMetric, ...
];
