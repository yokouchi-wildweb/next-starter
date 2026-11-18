# analytics/exclusion

## Overview

- 不正だった期間の行や不正だった人を管理画面の集計から外す条件を、fork が差し込む口。上流は口だけ（項目 0）で、除外の表・判定・解除の運用は fork が持つ。項目が無い間は集計の結果は変わらない。
- 使う時の決まりは札 .claude/rules/items/features/analytics.md にある

## Usage

- 項目: `exclusionProviders/<名前>.ts` の `export const provider: AnalyticsExclusionProvider` → `pnpm generate extensions`（型: `services/server/exclusion/types.ts`。`key` の重複は一覧の読み込みで例外）
- 集計の性質ごとに呼び手が scope を渡し、項目の対応する方だけが呼ばれる（返す SQL = 残す行の条件、AND で足す。関係なければ `undefined`）:
  - `flow`（期間の事実の行: 収支・購入・DAU・付与）→ `flow({ source, rowId, userId })`。除外した**行**だけを落とす
  - `stock`（残高・流通量など人ごとの状態）→ `stock({ userId })`。不正なコインは除外の期間の外の残高にも残るので、除外した**人**を丸ごと落とす
- 上流の集計の scope: flow = DAU（`user_daily_activities`）・購入系 4 本と `purchase_bonus_gap`（`purchase_requests`）・ウォレット履歴の日別 / サマリー / ランキング（`wallet_histories`）・`coupon_attribution_reward`（`coupon_attribution_rewards`、受取人）| stock = ウォレットの現在残高（state 軸）・日次残高（`userId` 指定の調査のときは付けない: その人のチャートが空になる）・紹介の報酬合計（受取人）と紹介経由数（invitee。roles / excludeDemo は今まで通り適用しないが、除外は足す）
- 自前の集計: `buildUserFilterConditions(userIdColumn, params, scope)`（roles / excludeDemo と一緒に）か `buildExclusionConditions(userIdColumn, params, scope)`（除外だけ）。scope を省くと除外は足さない（今まで通り）
- `includeExcluded: true`（クエリ `includeExcluded=true`）で足さない。比べる検証用で、通常の画面は指定しない
- 実行時機: 各集計のクエリを組み立てるとき（同期・読みだけ・tx なし）。項目の throw はその集計の 500。fork の除外の表が無いことがある間（機能を閉じた fork）は `enabled` で止める
- core の表に列・部分 index を足す形（`wallet_histories.analytics_exclusion_id` など）は上流の表を書き換えるので `pnpm workflow ownership check` で止まる。行の除外は fork の衛星表と行の id で突き合わせる:

```ts
// fork: src/features/analyticsExclusion/entities/drizzle.ts（fork の表。主キー (source, row_id) が NOT EXISTS の索引）
export const AnalyticsExcludedRowTable = pgTable("analytics_excluded_rows", {
  source: text("source").notNull(),        // "wallet_histories" など（scope の source）
  row_id: uuid("row_id").notNull(),        // 事実の表の id
  exclusion_id: uuid("exclusion_id").notNull(),
}, (t) => [primaryKey({ columns: [t.source, t.row_id] })]);

// fork: src/features/core/analytics/exclusionProviders/fraudRollback.ts → pnpm generate extensions
import { and, eq, sql } from "drizzle-orm";
import type { AnalyticsExclusionProvider } from "@/features/core/analytics/services/server/exclusion/types";
import { AnalyticsExcludedRowTable as x, AnalyticsExclusionTable as ex } from "@/features/analyticsExclusion/entities/drizzle";

export const provider: AnalyticsExclusionProvider = {
  key: "fraud_rollback",
  // 行: 衛星表に載った行を落とす
  flow: ({ source, rowId }) =>
    sql`NOT EXISTS (SELECT 1 FROM ${x} WHERE ${x.source} = ${source} AND ${x.row_id} = ${rowId})`,
  // 人: applied の除外の対象者を丸ごと落とす（除外の表は少数行なので NOT IN で足りる）
  stock: ({ userId }) =>
    sql`${userId} NOT IN (SELECT ${ex.user_id} FROM ${ex} WHERE ${ex.status} = 'applied')`,
};
