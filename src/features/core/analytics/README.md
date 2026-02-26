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
│   │   ├── aggregation.ts        # グルーピング、ユニークカウント等の集計ヘルパー
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

## タイムゾーン対応

- デフォルト: `Asia/Tokyo`（`constants/index.ts` の `DEFAULT_TIMEZONE`）
- 日付境界の計算（startOfDay/endOfDay）がタイムゾーンを考慮
- groupByDateのキー生成がタイムゾーンに基づいてYYYY-MM-DDを生成
- `Intl.DateTimeFormat` ベース（外部ライブラリ不要）

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

### 1. サービスファイルを追加

```typescript
// services/server/gachaAnalytics.ts
import { db } from "@/lib/drizzle";
import { GachaPlayTable } from "@/features/gacha/entities/drizzle";
import { resolveDateRange, generateDateKeys, formatDateRangeForResponse } from "./utils/dateRange";
import { groupByDate, countUnique } from "./utils/aggregation";
import { buildUserFilterConditions } from "./utils/userFilter";
import type { DateRangeParams, DailyAnalyticsResponse, UserFilter } from "@/features/core/analytics/types/common";

type GachaDailyData = {
  playCount: number;
  uniqueUsers: number;
  totalSpent: number;
};

export async function getGachaDaily(
  params: DateRangeParams & UserFilter,
): Promise<DailyAnalyticsResponse<GachaDailyData>> {
  const range = resolveDateRange(params);

  // 1. DBからレコード取得（ユーザーフィルタ適用）
  const conditions = [/* date conditions */];
  conditions.push(...buildUserFilterConditions(GachaPlayTable.user_id, params));
  const records = await db.select().from(GachaPlayTable).where(and(...conditions));

  // 2. 日別グルーピング（TZ対応）
  const grouped = groupByDate(records, (r) => r.createdAt, range.timezone);

  // 3. 日付キー生成（データなし日も含む）
  const dateKeys = generateDateKeys(range);

  // 4. 各日の集計
  const history = dateKeys.map((date) => {
    const dayRecords = grouped.get(date) ?? [];
    return {
      date,
      playCount: dayRecords.length,
      uniqueUsers: countUnique(dayRecords, (r) => r.user_id),
      totalSpent: dayRecords.reduce((sum, r) => sum + r.cost, 0),
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
