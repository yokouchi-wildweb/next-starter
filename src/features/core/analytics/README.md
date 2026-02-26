# analytics ドメイン

ドメインデータを時系列で集計・分析するためのフレームワーク。
他ドメインのテーブルを読み取り専用で参照し、共通の集計パターン（日別・期間サマリー・ランキング・残高推移）を提供する。

## ドメインの位置づけ

- core ドメイン（domain.json なし、手動管理）
- エンティティ: アップストリームでは持たない。下流で必要に応じて追加
- データ所有: なし（wallet_histories, purchase_requests 等を参照のみ）

## ディレクトリ構成

```
analytics/
├── README.md                     # 本ファイル
├── types/
│   ├── common.ts                 # 集計共通型（DateRangeParams, DailyRecord, UserFilter 等）
│   └── entities.ts               # エンティティ追加時の基底型（CacheBase, SnapshotBase 等）
├── entities/                     # アップストリームでは空。下流がテーブル定義を追加する場所
├── constants/
│   └── index.ts                  # デフォルト日数、最大値、デフォルトタイムゾーン等
├── services/server/
│   ├── utils/
│   │   ├── dateRange.ts          # 日付範囲パラメータの解決（TZ対応）
│   │   ├── aggregation.ts        # changeRate等の算術ヘルパー（※JS集計関数は@deprecated）
│   │   └── userFilter.ts         # ユーザー属性フィルター（roles, excludeDemo）
│   ├── walletHistoryAnalytics.ts # [組み込み] walletHistory 集計 + 日次残高
│   ├── purchaseAnalytics.ts      # [組み込み] purchase 集計
│   └── userRankingAnalytics.ts   # [組み込み] ユーザーランキング
└── presenters.ts                 # （任意）集計結果のフォーマット
```

## 組み込みAPI一覧

| エンドポイント | サービス | 概要 |
|---|---|---|
| GET /api/admin/analytics/wallet-history/daily | walletHistoryAnalytics | 日別ウォレット変動集計 |
| GET /api/admin/analytics/wallet-history/summary | walletHistoryAnalytics | 期間サマリー |
| GET /api/admin/analytics/wallet-history/balance | walletHistoryAnalytics | 日次残高（ランニングバランス） |
| GET /api/admin/analytics/purchase/daily | purchaseAnalytics | 日別売上集計 |
| GET /api/admin/analytics/purchase/summary | purchaseAnalytics | 期間売上サマリー |
| GET /api/admin/analytics/purchase/status-overview | purchaseAnalytics | ステータス概況 |
| GET /api/admin/analytics/user/ranking | userRankingAnalytics | ユーザーランキング |

## 共通クエリパラメータ

日付範囲（status-overview以外の全APIで共通）:
- `days`: 日数指定（デフォルト 30、最大 365）
- `dateFrom`: 開始日（YYYY-MM-DD）
- `dateTo`: 終了日（YYYY-MM-DD）
- `timezone`: タイムゾーン（IANA TZ名、デフォルト: `Asia/Tokyo`）
- dateFrom + dateTo 指定時は days より優先

ユーザーフィルタ:
- `userId`: 特定ユーザーに絞り込み（ranking以外）
- `roles`: 含めるロール（CSV、ホワイトリスト方式）。未指定=全ロール
- `excludeDemo`: `true` でデモユーザー（is_demo=true）を除外

フィルタ:
- `walletType`: ウォレット種別でフィルタ（指定なし = 全種別）

## 集計設計原則: DB側集計

**全ての集計処理はDB側 GROUP BY + 集約関数で実行すること。**

「全行フェッチ → JS集計」パターンは大量レコード（数万〜数十万行）でメモリ・速度の問題が発生するため禁止。
組み込みサービス（walletHistoryAnalytics, purchaseAnalytics, userRankingAnalytics）は全てSQL集計方式。

推奨SQLパターン:
- 日別集計: `GROUP BY DATE(column AT TIME ZONE $tz)` + `SUM()`, `COUNT(DISTINCT)`, `COUNT(*)`
- 期間サマリー: `SUM()`, `COUNT()`, `MAX()`, `PERCENTILE_CONT(0.5)` 等
- ランキング: `GROUP BY user_id` + `ORDER BY metric DESC` + `LIMIT/OFFSET`
- 内訳: 別クエリで `GROUP BY date, category` → Mapに変換

`aggregation.ts` のJS集計関数（`groupByDate`, `countUnique`, `groupBy`, `sum`, `median`）は `@deprecated`。
`changeRate` のみ引き続き利用可能。

## タイムゾーン対応

- デフォルト: `Asia/Tokyo`（`constants/index.ts` の `DEFAULT_TIMEZONE`）
- 日付境界の計算（startOfDay/endOfDay）がタイムゾーンを考慮
- SQL: `DATE(column AT TIME ZONE $tz)` でタイムゾーン対応の日付抽出
- JS: `Intl.DateTimeFormat` ベース（外部ライブラリ不要）

## ユーザーフィルター設計

roles パラメータ（ホワイトリスト方式）:
- 未指定: 全ロールを含む（フィルタなし）
- `roles=_user`: 一般ユーザーのみ
- `roles=_user,contributor`: 複数ロール指定

excludeDemo パラメータ:
- 未指定 or false: デモユーザーを含む
- `excludeDemo=true`: is_demo=true のユーザーを除外

実装: サブクエリ方式（JOIN不使用）。walletHistoryにはUserTableへのFKがないため、
`user_id IN/NOT IN (SELECT id FROM users WHERE ...)` パターンで条件を構築。

## ダウンストリームでの集計サービス追加

### 1. サービスファイルを追加（SQL集計方式）

```typescript
// services/server/gachaAnalytics.ts
import { db } from "@/lib/drizzle";
import { GachaPlayTable } from "@/features/gacha/entities/drizzle";
import { and, between, sql, type SQL } from "drizzle-orm";
import { resolveDateRange, generateDateKeys, formatDateRangeForResponse } from "./utils/dateRange";
import { buildUserFilterConditions } from "./utils/userFilter";
import type { DateRangeParams, DailyAnalyticsResponse, UserFilter } from "@/features/core/analytics/types/common";

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

### 2. 型ファイルを追加（任意）

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

### 3. APIルートを追加

```typescript
// src/app/api/admin/analytics/gacha/daily/route.ts
import { createApiRoute } from "@/lib/routeFactory";
import { parseDateRangeParams } from "@/features/core/analytics/services/server/utils/dateRange";
import { parseUserFilterParams } from "@/features/core/analytics/services/server/utils/userFilter";
import { getGachaDaily } from "@/features/core/analytics/services/server/gachaAnalytics";

export const GET = createApiRoute(
  { operation: "GET /api/admin/analytics/gacha/daily", operationType: "read" },
  async (req, { session }) => {
    // 管理者チェック...
    const { searchParams } = new URL(req.url);
    return getGachaDaily({
      ...parseDateRangeParams(searchParams),
      ...parseUserFilterParams(searchParams),
    });
  },
);
```

## エンティティの追加

アップストリームではエンティティを持たない。
下流で集計キャッシュ、スナップショット、ダッシュボード設定等が必要になった場合、`entities/` にテーブル定義を追加する。

### 基底型

`types/entities.ts` に以下の基底型を提供済み:
- `AnalyticsCacheBase`: 集計キャッシュテーブル用
- `AnalyticsSnapshotBase`: スナップショットテーブル用
- `DashboardConfigBase`: ダッシュボード設定テーブル用

### キャッシュテーブルの追加例

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

### 命名規約
- テーブル名: `analytics_` プレフィクス（例: `analytics_cache`, `analytics_snapshots`）
- metric_key / snapshot_key: snake_case（例: `daily_wallet_summary`, `wallet_balance_distribution`）
