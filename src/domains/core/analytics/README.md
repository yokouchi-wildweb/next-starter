# analytics

## Overview

- ドメインデータを時系列で集計・分析するためのフレームワーク。他ドメインのテーブルを読み取り専用で参照し、共通の集計パターン（日別・期間サマリー・ランキング・残高推移）を提供する
- 上流はデータの取り出しだけを出荷する（集計のサービス・管理 API `/api/admin/analytics/**`・rollup）。管理画面のページも管理メニューの項目も持たない。画面は fork が自分の業務に合わせて作り（`src/app/admin/(protected)/` の自分のルート + 管理メニューの受け口 `src/domains/core/admin/menu/` に項目）、この API を呼ぶ
- 使う時・直す時の決まりは札 .claude/rules/items/domains/analytics.md にある
- core ドメイン（domain.json なし、手動管理）
- 閉じられる機能(門番の規則 `src/featureGate/rules/analytics.ts`、既定は閉 `defaultEnabled: false`。開くのは fork の `src/config/featureGate/switches.config.ts` か `pnpm ops features set analytics on`)
- 閉じると `/api/admin/analytics`・`/api/activity/dau`・rollup の cron が 404 で、表も push から外れる
- ログイン中の DAU の記録は `useGate().enabled("analytics")` が閉なら送らない
- analyticsConsent の設定 `enabled`(上書き `src/config/lib/analyticsConsent.config.ts`)(ブラウザのアクセス解析の送信)は別物で、規則は読まない
- エンティティ: `user_daily_activities`（DAU 計測）と `analytics_daily_rollups`（日次事前集計）のみ。下流で必要に応じて追加
- データ所有: 原則なし（wallet_histories, purchase_requests 等を参照のみ）。例外は上記2テーブル
  - `user_daily_activities`: **本ドメインが所有する一次記録（source of truth）**。イベント発生時の ingest（useDauTracker → POST /api/activity/dau）でのみ生まれ、他テーブルから再計算**できない**
  - `analytics_daily_rollups`: ソーステーブルから再計算可能な**派生キャッシュ**（真実のソースではない）

### 組み込みAPI一覧

| エンドポイント | サービス | 概要 |
|---|---|---|
| GET /api/admin/analytics/wallet-history/daily | walletHistoryAnalytics | 日別ウォレット変動集計 |
| GET /api/admin/analytics/wallet-history/summary | walletHistoryAnalytics | 期間サマリー |
| GET /api/admin/analytics/wallet-history/balance | walletHistoryAnalytics | 日次残高（ランニングバランス） |
| GET /api/admin/analytics/purchase/daily | purchaseAnalytics | 日別売上集計 |
| GET /api/admin/analytics/purchase/summary | purchaseAnalytics | 期間売上サマリー |
| GET /api/admin/analytics/purchase/status-overview | purchaseAnalytics | ステータス概況 |
| GET /api/admin/analytics/purchase/distribution | purchaseDistributionAnalytics | 購入額グループ分布 |
| GET /api/admin/analytics/purchase/ranking | purchaseRankingAnalytics | 購入ランキング |
| GET /api/admin/analytics/purchase/registration-age | purchaseRegistrationAgeAnalytics | 登録からの経過日数別の購入分布 |
| GET /api/admin/analytics/user/registration/daily | userAnalytics | 日別ユーザー登録数 |
| GET /api/admin/analytics/user/registration/summary | userAnalytics | ユーザー登録期間サマリー |
| GET /api/admin/analytics/user/status-overview | userAnalytics | ユーザーステータス概況 |
| GET /api/admin/analytics/wallet/ranking | walletRankingAnalytics | ウォレット履歴ベースのランキング（増減量） |
| GET /api/admin/analytics/wallet/state/summary | walletStateAnalytics | ウォレット現在保有のサマリー（流通量・保有者数・平均/中央値/最大） |
| GET /api/admin/analytics/wallet/state/ranking | walletStateAnalytics | ウォレット現在保有量のランキング |
| GET /api/admin/analytics/wallet/state/distribution | walletStateAnalytics | ウォレット現在保有量のレンジ別分布 |
| GET /api/admin/analytics/referral/summary | referralAnalytics | 紹介経由ユーザー数 + 紹介リワード金額（前期比含む） |
| GET /api/admin/analytics/dau/daily | dauAnalytics | バケット別アクティブユーザー数（day=DAU / week=WAU / month=MAU、hour 不可） |
| GET /api/admin/analytics/dau/summary | dauAnalytics | DAU 期間サマリー（week/month はバケット単位の統計値） |
| GET /api/admin/analytics/dau/ranking | dauAnalytics | ユーザー別アクティブ日数ランキング（期間内の訪問日数 top-N、ページネーション付き） |
| GET /api/admin/analytics/dau/active-days-histogram | dauAnalytics | アクティブ日数ヒストグラム（ちょうど N 日アクティブだったユーザー数の分布） |
| GET /api/admin/analytics/coin-issuance/summary | coinIssuance | コイン創出サマリー（収入・発行・finalProfit を統合、前期比含む。下流で source 追加可） |
| GET /api/admin/analytics/messaging/summary | messagingAnalytics | 連絡の期間の合計（指標・率、前期比含む） |
| GET /api/admin/analytics/messaging/series | messagingAnalytics | 連絡のバケット別の指標（granularity） |
| GET /api/admin/analytics/messaging/breakdown | messagingAnalytics | 軸（`axis=channel / message / category / template / tag`）ごとの指標（前期比含む） |
| GET /api/admin/analytics/messaging/dispatches | messagingAnalytics | 送信ごとの指標（送った時刻の新しい順、`cursor` / `limit`。`dispatchIds=<id,…>`（1〜100）= その送信だけ、期間なし。hook `useMessagingAnalyticsDispatchReads`） |

- purchase 系(`purchase*Analytics`)は決済、wallet 系(`walletHistory` / `walletRanking` / `walletState`)はウォレットの機能の表を読むので、外に出す集計関数の先頭で `gate.assert("payment" / "wallet")`（閉なら 404。route のパスは門番の規則 `paymentAnalytics` / `walletAnalytics` が既に閉じるので、route 以外から呼んだときの自己停止）。

## Usage

### 集計サービスを足す

#### 1. サービスファイルを追加（SQL集計方式）

```typescript
// services/server/gachaAnalytics.ts
import { db } from "@/lib/drizzle";
import { GachaPlayTable } from "@/domains/gacha/entities/drizzle";
import { and, between, sql, type SQL } from "drizzle-orm";
import { resolveDateRange, generateDateKeys, formatDateRangeForResponse } from "./utils/dateRange";
import { buildUserFilterConditions } from "./utils/userFilter";
import type { DateRangeParams, DailyAnalyticsResponse, UserFilter } from "@/domains/core/analytics/types/common";

type GachaDailyData = {
  playCount: number;
  uniqueUsers: number;
  totalSpent: number;
};

const t = GachaPlayTable;

export async function getGachaDaily(
  params: DateRangeParams & UserFilter,
): Promise<DailyAnalyticsResponse<GachaDailyData>> {
  const range = resolveDateRange(params);
  const tz = range.timezone;
  const dateSql = sql<string>`DATE(${t.createdAt} AT TIME ZONE ${tz})`;

  // WHERE条件構築
  const conditions: SQL[] = [
    between(t.createdAt, range.dateFrom, range.dateTo),
    ...buildUserFilterConditions(t.user_id, params),
  ];

  // DB側 GROUP BY で日別集計（1クエリ）
  const dailyRows = await db
    .select({
      date: dateSql,
      playCount: sql<number>`COUNT(*)::int`.as("play_count"),
      uniqueUsers: sql<number>`COUNT(DISTINCT ${t.user_id})::int`.as("unique_users"),
      totalSpent: sql<number>`COALESCE(SUM(${t.cost}), 0)`.as("total_spent"),
    })
    .from(t)
    .where(and(...conditions))
    .groupBy(dateSql);

  // データなし日を埋めてレスポンス構築
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
  const dateKeys = generateDateKeys(range);

  const history = dateKeys.map((date) => {
    const row = dailyMap.get(date);
    return {
      date,
      playCount: row ? Number(row.playCount) : 0,
      uniqueUsers: row ? Number(row.uniqueUsers) : 0,
      totalSpent: row ? Number(row.totalSpent) : 0,
    };
  });

  return { ...formatDateRangeForResponse(range), history };
}
```

#### 2. 型ファイルを追加（任意）

レスポンス型が複雑な場合は `types/` に専用ファイルを追加:

```typescript
// types/gachaAnalytics.ts
import type { DailyRecord, BreakdownEntry } from "./common";

export type GachaDailyRecord = DailyRecord<{
  playCount: number;
  uniqueUsers: number;
  totalSpent: number;
  byRarity: Record<string, BreakdownEntry>;
}>;
```

#### 3. APIルートを追加

```typescript
// src/app/api/admin/analytics/gacha/daily/route.ts
import { createApiRoute } from "@/wiring/apiRoute";
import { parseDateRangeParams } from "@/domains/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/domains/core/analytics/services/server/utils/userFilter";
import { getGachaDaily } from "@/domains/core/analytics/services/server/gachaAnalytics";

export const GET = createApiRoute(
  { operation: "GET /api/admin/analytics/gacha/daily", operationType: "read", access: { roleCategories: ["admin"] } },
  async (req) => {
    const { searchParams } = new URL(req.url);
    return getGachaDaily({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
    });
  },
);
```

### 時系列サービスでの granularity の扱い

新しい時系列集計サービスを実装する場合:
- `resolveDateRange(params)` の戻り値から `range.granularity` を読み取る
- グルーピング SQL は `granularityDateExpr(column, granularity, tz)` ヘルパーで生成する
- date 型カラム（timestamptz ではない）は `granularityDateExprForDateColumn(column, granularity)` を使う（AT TIME ZONE 変換を挟むとサーバ TZ 依存の境界ズレが起きるため）
- `generateDateKeys(range)` がそのまま粒度対応のキー配列を返す
- `formatDateRangeForResponse(range)` がレスポンスの `granularity` フィールドを含む

特定粒度のみサポートするサービス（例: DAU は hour 非対応）:
- `export const FOO_SUPPORTED_GRANULARITIES = ["day"] as const satisfies readonly Granularity[];`
- 関数冒頭で `assertGranularitySupported(range.granularity, FOO_SUPPORTED_GRANULARITIES, "Foo 集計")` を呼ぶ
- 未サポート粒度では `GranularityNotSupportedError`（DomainError 派生、400）が投げられる

新しい粒度（例: minute）を追加する場合:
- `types/common.ts` の `Granularity` / `GRANULARITIES` に追加
- `constants/index.ts` の `MAX_GRANULARITY_PERIOD_DAYS` に上限を追加
- `utils/dateRange.ts` の `GRANULARITY_SPECS` テーブルに `truncUnit` / `sqlFormatPattern` / `formatKey` / `truncate` / `advance` を追加
- 既存サービスは変更不要（拡張ポイントが 1 箇所に集約されている）

### レスポンスキャッシュ（withAnalyticsCache）

- `services/server/utils/analyticsCache.ts` が提供する透過ラッパー。「過去日のみで構成される確定済み範囲は長期TTL、当日を含む範囲は短TTL」を `ResolvedDateRange` から自動判定してインスタンス内メモリにキャッシュする

```typescript
import { withAnalyticsCache } from "./utils/analyticsCache";

export async function getWalletSummary(params: DateRangeParams & WalletTypeFilter) {
  const range = resolveDateRange(params);
  return withAnalyticsCache(
    // key = クエリ結果に影響する全パラメータ（range は自動合成される）
    { key: ["walletHistory.summary", params.walletType ?? ""], range },
    () => computeWalletSummary(range, params),
  );
}
```

### 残高の系列（getWalletBalanceSeries）

history 軸の残高推移の公開の入口（server）。`getWalletBalanceDaily`（API `/wallet-history/balance`）と同じ式で、複数の wallet type を合算できる。fork の画面の系列（特定の種別の組の残高推移など）は、この関数を自分の route から呼ぶ。

```ts
import { getWalletBalanceSeries } from "@/domains/core/analytics/services/server/walletHistoryAnalytics";

const { history, walletTypes } = await getWalletBalanceSeries({
  dateFrom: "2026-10-01",
  dateTo: "2026-10-31",
  walletTypes: ["prize_deposit", "prize_deposit_bonus"], // 省略・空 = 全種別 / 1 つ = その種別 / 複数 = 合算
  // granularity, timezone, roles, excludeDemo, userId, includeExcluded も受ける（DateRangeParams・UserFilter と同じ）
});
// history: [{ date, closingBalance }, ...]（バケットごとの終了時点の残高。データの無いバケットは前の値を引き継ぐ）
```

- 合算: per-(user, type) の最新 `balance_after` のアンカー差分を合計する（種別ごとの系列の和と一致）。単位の違う種別を合算する意味は呼び手が持つ
- 除外: `userId` 指定なしは除外の受け口の stock（人ごとの状態の集計。除外した人を丸ごと落とす）、`userId` 指定ありは付けない。`includeExcluded: true` で外す（`services/server/exclusion/README.md`）
- 活動（`activeUsers` / `recordCount`）は集計しない（クエリ 1 本）。要るなら `getWalletBalanceDaily`（walletType 1 つ、活動付き）

### エンティティの追加

アップストリームが持つのは `user_daily_activities`（DAU）と `analytics_daily_rollups`（日次ロールアップ）のみ。
日次の事前集計は、独自テーブルより先にロールアップ(`rollupMetrics/README.md`)で足りるかを見る（CLAUDE.md ITEMS analytics_perf）。
それ以外の集計キャッシュ、スナップショット、ダッシュボード設定等が必要になった場合、`entities/` にテーブル定義を追加する。

- 基底型(`types/entities.ts`): `AnalyticsCacheBase`（集計キャッシュテーブル用）/ `AnalyticsSnapshotBase`（スナップショットテーブル用）/ `DashboardConfigBase`（ダッシュボード設定テーブル用）
- 命名: テーブル名は `analytics_` プレフィクス（例: `analytics_cache`, `analytics_snapshots`）、metric_key / snapshot_key は snake_case（例: `daily_wallet_summary`）

```typescript
// entities/drizzle.ts
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const AnalyticsCacheTable = pgTable(
  "analytics_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    metric_key: text("metric_key").notNull(),
    period_start: timestamp("period_start", { withTimezone: true }).notNull(),
    period_end: timestamp("period_end", { withTimezone: true }).notNull(),
    granularity: text("granularity").notNull().default("daily"),
    parameters: jsonb("parameters").default({}),
    result: jsonb("result").notNull(),
    computed_at: timestamp("computed_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    metricPeriodIdx: index("analytics_cache_metric_period_idx")
      .on(table.metric_key, table.period_start),
    metricGranularityIdx: index("analytics_cache_metric_granularity_idx")
      .on(table.metric_key, table.granularity),
  }),
);
```

## API

- 共通クエリパラメータ・referral summary・DAU 系・ランキング(ウォレット vs 購入)・ウォレット系(history 軸 vs state 軸)の仕様は同じフォルダの `API.md`

## Extension

- 受け口(`extensionPoints.ts`、`pnpm generate extensions`): `rollupMetrics`（日次ロールアップのメトリクス、`rollupMetrics/README.md`）/ `coinIssuanceSources`（コイン創出のソース、`services/server/coinIssuance/README.md`）/ `exclusionProviders`（分析の除外条件、`services/server/exclusion/README.md`）
- 設定の上書き `src/config/domains/analytics.config.ts`: `coinIssuanceWalletTypes` / `coinIssuanceLabels` / `issuanceReasonCategories`（意味は `services/server/coinIssuance/README.md`）

## Internals

### DB 側集計

- 組み込みサービスは全て SQL 集計方式。「全行フェッチ → JS集計」は大量レコード（数万〜数十万行）でメモリ・速度の問題が出る
- 日別集計: `GROUP BY DATE(column AT TIME ZONE $tz)` + `SUM()`, `COUNT(DISTINCT)`, `COUNT(*)`
- 期間サマリー: `SUM()`, `COUNT()`, `MAX()`, `PERCENTILE_CONT(0.5)` 等
- ランキング: `GROUP BY user_id` + `ORDER BY metric DESC` + `LIMIT/OFFSET`
- 内訳: 別クエリで `GROUP BY date, category` → Mapに変換
- JS で集計する関数は持たない。`aggregation.ts` は `changeRate` だけ

### レスポンスキャッシュの挙動

- **確定済み判定**: `range.dateTo` が `range.timezone` 上の「今日」より前なら確定済み（TTL 既定 12時間）。当日を含むなら短TTL（既定 60秒）。TTL は `ttlClosedMs` / `ttlLiveMs` オプション、既定値は `constants/index.ts` で調整可
- **immutable ではない**: バックフィル・ロールアップ再計算・集計除外の遡及適用で過去バケットも書き換わり得るため、確定済みでも有限TTL。値を書き換えた直後は `invalidateAnalyticsCache(keyPrefix?)` を呼ぶ（同一インスタンスのみ即時。他インスタンスはTTL満了で追随）
- **in-flight 共有**: 同一キーの同時リクエストは計算を1回に集約する（ダッシュボードの並列取得対策）
- **例外はキャッシュしない**: fn が reject した場合エントリは破棄される
- **スコープ**: インスタンス内メモリLRU（最大 `ANALYTICS_CACHE_MAX_ENTRIES` 件）。サーバーレス多インスタンス間では共有されない（許容仕様）
- **無効化エスケープハッチ**: 環境変数 `ANALYTICS_CACHE=disabled` で全キャッシュ素通し（デバッグ用）
- **組み込みサービスには未適用**: 鮮度特性の変更を暗黙に持ち込まないため、上流の組み込み API はラップしていない。負荷の高いエンドポイント（複合ダッシュボード等）から呼び手が順に包む

### タイムゾーン

- デフォルト: `Asia/Tokyo`（`constants/index.ts` の `DEFAULT_TIMEZONE`）
- 日付境界の計算（startOfDay/endOfDay）がタイムゾーンを考慮
- SQL: `DATE(column AT TIME ZONE $tz)` でタイムゾーン対応の日付抽出
- JS: `Intl.DateTimeFormat` ベース（外部ライブラリ不要）

### ユーザーフィルター

roles パラメータ（ホワイトリスト方式）:
- 未指定: 全ロールを含む（フィルタなし）
- `roles=_user`: 一般ユーザーのみ
- `roles=_user,contributor`: 複数ロール指定

excludeDemo パラメータ:
- 未指定 or false: デモユーザーを含む
- `excludeDemo=true`: is_demo=true のユーザーを除外

実装: サブクエリ方式（JOIN不使用）。walletHistoryにはUserTableへのFKがないため、
`user_id IN/NOT IN (SELECT id FROM users WHERE ...)` パターンで条件を構築。

## Related

- `rollupMetrics/README.md`: 日次ロールアップ（事前集計）フレームワークとメトリクスの受け口
- `services/server/coinIssuance/README.md`: コイン創出サマリーとソースの受け口
- `services/server/exclusion/README.md`: 分析の除外条件（exclusionProviders）
- `services/server/messagingAnalytics/README.md`: 連絡（messaging）の集計
