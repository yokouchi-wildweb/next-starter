# analytics ドメイン

ドメインデータを時系列で集計・分析するためのフレームワーク。
他ドメインのテーブルを読み取り専用で参照し、共通の集計パターン（日別・期間サマリー・ランキング・残高推移）を提供する。

## ドメインの位置づけ

- core ドメイン（domain.json なし、手動管理）
- エンティティ: `user_daily_activities`（DAU 計測）と `analytics_daily_rollups`（日次事前集計）のみ。下流で必要に応じて追加
- データ所有: 原則なし（wallet_histories, purchase_requests 等を参照のみ）。例外は上記2テーブル
  - `user_daily_activities`: **本ドメインが所有する一次記録（source of truth）**。イベント発生時の ingest（useDauTracker → POST /api/activity/dau）でのみ生まれ、他テーブルから再計算**できない**
  - `analytics_daily_rollups`: ソーステーブルから再計算可能な**派生キャッシュ**（真実のソースではない）

## ディレクトリ構成

```
analytics/
├── README.md                     # 本ファイル
├── types/
│   ├── common.ts                 # 集計共通型（DateRangeParams, DailyRecord, UserFilter 等）
│   └── entities.ts               # エンティティ追加時の基底型（CacheBase, SnapshotBase 等）
├── entities/
│   └── drizzle.ts                # user_daily_activities（DAU）+ analytics_daily_rollups（ロールアップ）
├── constants/
│   └── index.ts                  # デフォルト日数、最大値、デフォルトタイムゾーン、キャッシュTTL等
├── services/server/
│   ├── utils/
│   │   ├── dateRange.ts          # 日付範囲パラメータの解決（TZ対応）
│   │   ├── analyticsCache.ts     # サーバーサイドレスポンスキャッシュ（確定範囲=長TTL）
│   │   ├── aggregation.ts        # changeRate等の算術ヘルパー（※JS集計関数は@deprecated）
│   │   ├── distribution.ts       # 分布共通: parseBoundaries / buildBucketExpr
│   │   └── userFilter.ts         # ユーザー属性フィルター（roles, excludeDemo）
│   ├── rollup/                   # 日次ロールアップ（事前集計）フレームワーク
│   │   ├── types.ts              # RollupMetricConfig / RollupDayContext 等
│   │   ├── rollupService.ts      # 計算+冪等upsert・日次cron・バックフィル
│   │   └── readSeries.ts         # readRolledDailySeries（確定日+当日ライブのマージ読み）
│   ├── walletHistoryAnalytics.ts # [組み込み] walletHistory 集計 + 日次残高
│   ├── walletStateAnalytics.ts   # [組み込み] wallets テーブルのスナップショット集計
│   ├── purchaseAnalytics.ts      # [組み込み] purchase 集計
│   ├── purchaseDistributionAnalytics.ts # [組み込み] 購入額グループ分布
│   ├── purchaseRankingAnalytics.ts      # [組み込み] 購入ランキング（purchase_requests）
│   ├── userAnalytics.ts                 # [組み込み] ユーザー登録集計
│   ├── walletRankingAnalytics.ts        # [組み込み] ウォレットランキング（wallet_histories）
│   ├── referralAnalytics.ts             # [組み込み] 紹介経由ユーザー数 + 紹介リワード金額のサマリー
│   ├── dauAnalytics.ts                  # [組み込み] DAU (Daily Active Users) 集計
│   └── dauService.ts                    # [組み込み] DAU 記録の書き込み API
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
| GET /api/admin/analytics/purchase/distribution | purchaseDistributionAnalytics | 購入額グループ分布 |
| GET /api/admin/analytics/purchase/ranking | purchaseRankingAnalytics | 購入ランキング |
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
| GET /api/admin/analytics/coin-issuance/summary | coinIssuance | コイン創出サマリー（収入・発行・finalProfit を統合、前期比含む。下流で source 追加可） |

### referral summary 固有のパラメータ
- `referralStatuses`: 集計対象とする `referrals.status` を CSV で指定（例: `active,cancelled`）。省略時は全状態をカウント
- リワード金額の抽出 SQL 式は `getReferralSummary()` の `rewardAmountExpr` 引数で差し替え可能。デフォルトは `(referral_rewards.metadata ->> 'amount')::numeric`（rewardHandler が metadata に `amount: number` を入れる規約に従う場合）。下流が異なる metadata 構造を持つ場合は独自の API ルートからカスタム SQL を渡す

## 共通クエリパラメータ

日付範囲（status-overview以外の全APIで共通）:
- `days`: 日数指定（デフォルト 30）
- `dateFrom`: 開始日（YYYY-MM-DD）
- `dateTo`: 終了日（YYYY-MM-DD）
- `timezone`: タイムゾーン（IANA TZ名、デフォルト: `Asia/Tokyo`）
- `granularity`: 集計粒度。`hour` / `day` / `week` / `month`（デフォルト: `day`）
- `alignToGranularity`: `true`（または `1`）で dateFrom を粒度のバケット開始境界（week=ISO月曜、month=月初）へ floor する。デフォルト off。先頭の不完全バケットがフロー系メトリクスで過少表示されるのを防ぐ用途
- dateFrom + dateTo 指定時は days より優先

集計粒度（granularity）の挙動:
- 時系列集計 API (`*/daily`, `wallet-history/balance` 等) のバケット単位を切り替える
- `history[].date` の書式は粒度で変わる: hour=`YYYY-MM-DDTHH:00`, day=`YYYY-MM-DD`, week=月曜開始日 `YYYY-MM-DD`, month=`YYYY-MM`
- レスポンスには解決済み `granularity` フィールドが含まれる
- 期間上限は粒度ごと: hour=31日, day=365日, week=2年, month=10年（バケット数の爆発を防ぐ）
- DAU は `day` / `week` / `month` をサポート（week/month はバケット内ユニークユーザー = WAU/MAU）。`hour` は `DomainError`（400）（`UserDailyActivityTable` が日次集計済みのため）
- 期間サマリー API (`*/summary`) では集計に影響しない（期間全体を1つの集計値にする）

ユーザーフィルタ:
- `userId`: 特定ユーザーに絞り込み（ranking以外）
- `roles`: 含めるロール（CSV、ホワイトリスト方式）。未指定=全ロール
- `excludeDemo`: `true` でデモユーザー（is_demo=true）を除外

フィルタ:
- `walletType`: ウォレット種別でフィルタ（指定なし = 全種別）

### サービスでの granularity 取り扱い

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

## 集計設計原則: DB側集計

**全ての集計処理はDB側 GROUP BY + 集約関数で実行すること。**

「全行フェッチ → JS集計」パターンは大量レコード（数万〜数十万行）でメモリ・速度の問題が発生するため禁止。
組み込みサービスは全てSQL集計方式。

推奨SQLパターン:
- 日別集計: `GROUP BY DATE(column AT TIME ZONE $tz)` + `SUM()`, `COUNT(DISTINCT)`, `COUNT(*)`
- 期間サマリー: `SUM()`, `COUNT()`, `MAX()`, `PERCENTILE_CONT(0.5)` 等
- ランキング: `GROUP BY user_id` + `ORDER BY metric DESC` + `LIMIT/OFFSET`
- 内訳: 別クエリで `GROUP BY date, category` → Mapに変換

`aggregation.ts` のJS集計関数（`groupByDate`, `countUnique`, `groupBy`, `sum`, `median`）は `@deprecated`。
`changeRate` のみ引き続き利用可能。

## サーバーサイドレスポンスキャッシュ（withAnalyticsCache）

`services/server/utils/analyticsCache.ts` が提供する透過ラッパー。
「過去日のみで構成される確定済み範囲は長期TTL、当日を含む範囲は短TTL」を `ResolvedDateRange` から自動判定してインスタンス内メモリにキャッシュする。

```typescript
import { withAnalyticsCache } from "./utils/analyticsCache";

export async function getWalletSummary(params: DateRangeParams & WalletTypeFilter) {
  const range = resolveDateRange(params);
  return withAnalyticsCache(
    // key にはクエリ結果に影響する全パラメータを含めること（range は自動合成される）
    { key: ["walletHistory.summary", params.walletType ?? ""], range },
    () => computeWalletSummary(range, params),
  );
}
```

挙動・運用ルール:
- **確定済み判定**: `range.dateTo` が `range.timezone` 上の「今日」より前なら確定済み（TTL 既定 12時間）。当日を含むなら短TTL（既定 60秒）。TTL は `ttlClosedMs` / `ttlLiveMs` オプション、既定値は `constants/index.ts` で調整可
- **immutable ではない**: バックフィル・ロールアップ再計算・集計除外の遡及適用で過去バケットも書き換わり得るため、確定済みでも有限TTL。値を書き換えた直後は `invalidateAnalyticsCache(keyPrefix?)` を呼ぶ（同一インスタンスのみ即時。他インスタンスはTTL満了で追随）
- **in-flight 共有**: 同一キーの同時リクエストは計算を1回に集約する（ダッシュボードの並列取得対策）
- **例外はキャッシュしない**: fn が reject した場合エントリは破棄される
- **スコープ**: インスタンス内メモリLRU（最大 `ANALYTICS_CACHE_MAX_ENTRIES` 件）。サーバーレス多インスタンス間では共有されない（許容仕様）
- **無効化エスケープハッチ**: 環境変数 `ANALYTICS_CACHE=disabled` で全キャッシュ素通し（デバッグ用）
- **組み込みサービスには未適用**: 鮮度特性の変更を暗黙に持ち込まないため、アップストリーム組み込み API はラップしていない。ダウンストリームが負荷の高いエンドポイント（複合ダッシュボード等）から順に opt-in する

## 日次ロールアップ（事前集計）フレームワーク

`services/server/rollup/` が提供する GA スタイルの事前集計基盤。
「確定した過去日の値を `analytics_daily_rollups` に日次で焼き込み、読み取りは PK ルックアップ + 当日だけライブ計算」に置き換えることで、
**サービス運用年数に比例して重くなる集計**（特にランニングバランス系のベースライン全履歴スキャン）を構造的に解消する。

役割分担: **フレームワーク（保存・cron・マージ読み）= upstream、メトリクス定義（compute）= downstream**。
upstream は組み込みメトリクスを登録しない。

### 採用判断

- 使う: 全履歴スキャンを伴うランニングバランス系列（流通コイン残高・未消化賞品価値等）、期間が長くなるほど重いダッシュボード時系列
- 使わない: 既に単純な `GROUP BY date` 1クエリで十分軽い集計（まず `withAnalyticsCache` だけで足りないか検討）。ロールアップはテーブル・cron・バックフィル運用を伴うため、キャッシュより導入コストが高い
- 位置づけ: ロールアップ行は**ソーステーブルから再計算可能な派生キャッシュ**。真実のソースにしない（COUNTING 基盤の userCounter / interactionTracking はイベント発生時の一次記録であり役割が異なる）

### kind の選択（重要）

| kind | 意味 | 週/月集約 | 欠損日 | 例 |
|---|---|---|---|---|
| `flow` | 日ごとの発生量 | 日の合計 | 0 | 日次売上、ガチャ収支 |
| `snapshot` | 日末時点の状態量（クロージング値） | バケット末日の値 | 直前値キャリー | 流通コイン残高、未消化賞品価値 |

`snapshot` は読み取り時に「範囲開始前の直近行」を1行だけベースラインとして先読みするため、
ランニングバランスでも全履歴スキャンが発生しない。

### メトリクスの登録（downstream）

```typescript
// 例: src/features/wallet/analytics/rollup/coinClosingBalance.ts
import { sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import type { RollupMetricConfig } from "@/features/core/analytics/services/server/rollup";

export const coinClosingBalanceMetric: RollupMetricConfig = {
  key: "wallet.coin_closing_balance",
  kind: "snapshot",
  backfillFrom: "2025-01-01", // ソースデータの開始日
  async compute({ dateFrom, dateTo, previous }) {
    // snapshot 推奨パターン: 前日クロージング値があれば「前日値 + 当日差分」の増分計算。
    // previous 無し（初日・ギャップ）はフル計算にフォールバック。
    // 集計除外（analytics exclusion 等）の適用はこの関数内部の責務。
    const baseline = previous?.[0]?.value;
    if (baseline !== undefined) {
      const delta = await sumDailyDelta(dateFrom, dateTo); // 当日1日分のみのスキャン
      return [{ value: baseline + delta }];
    }
    const full = await computeBalanceUpTo(dateTo); // フォールバック: 全履歴から算出
    return [{ value: full }];
  },
};
```

```typescript
// src/registry/analyticsRollupRegistry.ts に追加
import { coinClosingBalanceMetric } from "@/features/wallet/analytics/rollup/coinClosingBalance";

export const analyticsRollupMetrics: RollupMetricConfig[] = [
  coinClosingBalanceMetric,
];
```

ディメンション分割が必要な場合は `compute` が `[{ value, dims: { walletType: "coin" } }, ...]` のように複数行を返す
（dims はフラットなオブジェクトのみ。同一日内で dims の重複は不可）。

### 運用（cron / バックフィル）

- 日次: `pnpm cron analytics-rollup-daily`（推奨 `15 0 * * *`）または `GET /api/cron/analytics-rollup-daily`。昨日を含む直近3日を冪等に再計算し、遅延到着データと実行漏れを自己修復する
- 新規メトリクス登録時・遡及修正時: `pnpm cron analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]`（from 省略時 = `backfillFrom`、to 省略時 = 昨日）
- **集計除外の遡及適用**: 専用機構はない。compute が除外を織り込んでいる前提で、該当期間のバックフィルを再実行すれば整合する（書き込みは日単位 delete → insert の冪等 upsert）
- 書き込み後は同一インスタンスの `withAnalyticsCache` キャッシュを自動 invalidate する（他インスタンスは TTL 満了で追随）

### 読み取り

```typescript
import { readRolledDailySeries } from "@/features/core/analytics/services/server/rollup";

const series = await readRolledDailySeries({
  metricKey: "wallet.coin_closing_balance",
  range, // resolveDateRange の戻り値
  // dims: { walletType: "coin" },  // 指定時は完全一致、省略時はディメンション横断で合算
});
// → { dateFrom, dateTo, granularity, history: [{ date, value }], includesLiveBucket }
```

- 確定日はロールアップ行から、当日は `compute` のライブ実行値をマージ（`includeLive: false` で無効化可）
- granularity は `day` / `week` / `month`（`hour` は `GranularityNotSupportedError`。日次行が最小単位のため）
- `range.timezone` はメトリクスの timezone（既定 `Asia/Tokyo`）と一致必須（バケット境界の整合のため）
- `withAnalyticsCache` と合成可能（キャッシュが手前、ロールアップが奥。当日を含む範囲は短TTL側に自動判定されるため相性が良い）
- 既存のライブ集計サービスのシグネチャは変更しない。メトリクス単位で読み取りパスをロールアップへ**段階的に**置き換える

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

## コイン創出サマリーへの参加方法

`GET /api/admin/analytics/coin-issuance/summary` は **拡張可能な集計レジストリ** を採用しており、各ドメインが「コイン創出ソース (`CoinIssuanceSource`)」を登録するだけでサービス全体の `finalProfit` 計算に組み込まれる。
upstream / downstream の双方がソースを登録できるため、サービス間で「最終収支」の定義がブレることを防ぐ。

### 概念

各ソースは 1 種類のコイン収支寄与を表す。

- `kind: "revenue"` … 収入源 (例: ガチャ売上)。`finalProfit` に加算される
- `kind: "issuance"` … 発行源 = サービスが負担する費用 (例: クーポンボーナス、紹介リワード、当選報告特典)。`finalProfit` から減算される

`finalProfit = Σ revenue.current − Σ issuance.current`

### upstream 組み込みソース

| key | kind | 概要 |
|---|---|---|
| `purchase_bonus_gap` | issuance | `purchase_requests` の `SUM(amount - payment_amount) WHERE status='completed'`（コイン購入時にサービスが負担した上乗せボーナス全般＝クーポン割引・ユーザーランクボーナス・決済方法ボーナス・購入パッケージのボーナスを含む）|
| `referral_reward` | issuance | `referral_rewards` の `status='fulfilled'` 金額合計 (`getReferralSummary().rewardTotal` と同 SQL) |

### ソース追加の手順 (downstream)

1. `CoinIssuanceSource` を満たす値を作成する
2. `src/registry/coinIssuanceRegistry.ts` の配列に追加する
3. (任意) `services/server/coinIssuance/labels.ts` の `registerCoinIssuanceLabels` で表示名を登録する

### 実装テンプレート

```typescript
// 例: src/features/gacha/analytics/coinIssuance/gachaProfitSource.ts
import { db } from "@/lib/drizzle";
import { GachaPlayTable } from "@/features/gacha/entities/drizzle";
import { and, between, sql } from "drizzle-orm";
import { buildUserFilterConditions } from "@/features/core/analytics/services/server/utils/userFilter";
import type { CoinIssuanceSource } from "@/features/core/analytics/services/server/coinIssuance";

const t = GachaPlayTable;

export const gachaProfitSource: CoinIssuanceSource = {
  key: "gacha_profit",
  kind: "revenue",

  async aggregate({ range, prevRange, userFilter }) {
    const isCurrent = sql`(${t.createdAt} >= ${range.dateFrom.toISOString()} AND ${t.createdAt} <= ${range.dateTo.toISOString()})`;
    const isPrev = sql`(${t.createdAt} >= ${prevRange.dateFrom.toISOString()} AND ${t.createdAt} <= ${prevRange.dateTo.toISOString()})`;

    // 当期+前期を CASE WHEN で 1 クエリ集計
    const rows = await db
      .select({
        current: sql<number>`COALESCE(SUM(CASE WHEN ${isCurrent} THEN ${t.profit} ELSE 0 END), 0)`.as("current_profit"),
        previous: sql<number>`COALESCE(SUM(CASE WHEN ${isPrev} THEN ${t.profit} ELSE 0 END), 0)`.as("prev_profit"),
      })
      .from(t)
      .where(and(
        between(t.createdAt, prevRange.dateFrom, range.dateTo),
        ...buildUserFilterConditions(t.user_id, userFilter),
      ));

    return {
      current: Number(rows[0]?.current ?? 0),
      previous: Number(rows[0]?.previous ?? 0),
    };
  },
};
```

```typescript
// src/registry/coinIssuanceRegistry.ts に追加
import { gachaProfitSource } from "@/features/gacha/analytics/coinIssuance/gachaProfitSource";

export const coinIssuanceSources: CoinIssuanceSource[] = [
  // --- CORE (upstream-provided) ---
  purchaseBonusGapSource,
  referralRewardSource,

  // --- DOWNSTREAM ---
  gachaProfitSource,
  // winningReportRewardSource, winningCommentRewardSource, ...
];
```

```typescript
// (任意) ラベル登録 (downstream の任意の初期化箇所)
import { registerCoinIssuanceLabels } from "@/features/core/analytics/services/server/coinIssuance/labels";

registerCoinIssuanceLabels({
  gacha_profit: "ガチャ収支",
  winning_report_reward: "当選報告特典",
});
```

### 実装上のベストプラクティス

#### 1. 付与額のスナップショットカラムを推奨

報酬・特典系の付与額は **ドメインテーブルに専用カラム** として持つことを強く推奨する。

- **推奨**: 付与時に `promotion_reward_coin_amount: integer` 等のカラムへスナップショット書き込み → 集計は `SUM(promotion_reward_coin_amount)` で済む
- **非推奨**: `wallet_history.reason LIKE '当選報告特典%'` のような文字列マッチ集計

専用カラム方式のメリット:
- reason 文字列の変更や handler 追加に強い (`promotion_reward_coin_amount` の意味は固定)
- 集計 SQL が単純化される (LIKE / 正規表現を避けられる)
- 監査ログとの整合が取りやすい

専用カラムが追加できない事情がある場合のみ wallet_history からの集計を選ぶ。

#### 2. 当期+前期を 1 クエリで集計

各ソースは `Promise.all` で並列実行されるため個別ソース内のクエリ数は少ない方が良い。
**当期と前期を別クエリにせず、`CASE WHEN` で 1 クエリにまとめる** (上記テンプレート参照)。
これは既存 summary 系 (`purchaseAnalytics`, `referralAnalytics`) と同じパターン。

#### 3. UserFilter は意味のある場合のみ適用

`userFilter (roles / excludeDemo)` は対象テーブルの `user_id` カラムに対して
`buildUserFilterConditions(column, userFilter)` で適用できる。
ただし「発行先 user を絞り込むことが意味を持たないソース」(e.g. `referral_reward` の rewardTotal) は適用しない。

#### 4. 戻り値は常に絶対値

`CoinIssuanceSource.aggregate()` の戻り値 `{current, previous}` は **絶対値 (正の数)** とする。
符号反転 (issuance を finalProfit から減算する処理) は aggregator の責務なので、
ソース側で `-` を返さないこと。

#### 5. key 命名

`CoinIssuanceSource.key` は API レスポンスの `sources` Record のキーとしてそのまま使われる。
upstream の key と衝突しない snake_case を選ぶ。
`gacha_profit`, `winning_report_reward`, `winning_comment_reward` 等、ソースの意味が読み取れる命名にする。

### `referralReward` の金額抽出 SQL を差し替える

`referralReward` ソースは `metadata ->> 'amount'` で金額を抽出する規約に従う。
規約が異なる downstream は、`aggregateReferralRewardCurrentVsPrev` を直接呼ぶカスタム source を実装するか、
`referralRewardSource` を置き換える形で独自 source を登録する。

```typescript
import { sql } from "drizzle-orm";
import { ReferralRewardTable } from "@/features/core/referralReward/entities/drizzle";
import { aggregateReferralRewardCurrentVsPrev } from "@/features/core/analytics/services/server/referralAnalytics";
import type { CoinIssuanceSource } from "@/features/core/analytics/services/server/coinIssuance";

// 独自 metadata 構造 ({ rewardCoins: number } 等) を持つ downstream 用
export const customReferralRewardSource: CoinIssuanceSource = {
  key: "referral_reward",
  kind: "issuance",
  async aggregate({ range, prevRange }) {
    return aggregateReferralRewardCurrentVsPrev({
      range,
      prevRange,
      rewardAmountExpr: sql<number>`(${ReferralRewardTable.metadata} ->> 'rewardCoins')::numeric`,
    });
  },
};
```

### Breaking Changes: コイン創出ソース key 変更履歴

upstream で組み込みソースの `key` をリネームした際の移行履歴。ダウンストリームは pull 時に該当項目があれば対応すること。

#### `coupon_bonus_gap` → `purchase_bonus_gap`

| 項目 | 旧 | 新 |
|---|---|---|
| ソース key (API レスポンス `sources` のキー) | `coupon_bonus_gap` | `purchase_bonus_gap` |
| TS シンボル | `couponBonusGapSource` | `purchaseBonusGapSource` |
| ファイル名 | `sources/couponBonusGap.ts` | `sources/purchaseBonusGap.ts` |
| 表示ラベル (labels.ts) | 「クーポン・ボーナス発行」 | 「購入時ボーナス発行」 |

**変更理由**: 集計式は `purchase_requests.SUM(amount - payment_amount) WHERE status='completed'` のままで、クーポン割引だけでなくユーザーランクボーナス・決済方法ボーナス・購入パッケージのボーナス等「コイン購入時にサービス側が負担した上乗せ全般」を集計している。旧名称は実態より狭く誤解を招くため、購入と無関係なコインボーナス (紹介リワード・当選報告特典等) との区別を明確にするためリネームした。

**ダウンストリーム移行手順**:

1. `coinIssuanceRegistry.ts` の import 文を `purchaseBonusGap` 系シンボルに置換 (上記表参照)。
2. 管理画面ダッシュボード等で `sources["coupon_bonus_gap"]` をハードコード参照している箇所を `sources["purchase_bonus_gap"]` に置換。
   - grep 推奨: `grep -rn "coupon_bonus_gap\|couponBonusGap" src/`
3. ダウンストリーム独自に `registerCoinIssuanceLabels({ coupon_bonus_gap: "..." })` でラベルを上書きしていた場合は新 key に変更。
4. 「コインボーナス」というラベル文字列を独自に表示していた場合は `getCoinIssuanceLabel("purchase_bonus_gap")` で取得する形に統一を推奨 (upstream で「購入時ボーナス発行」が登録済み)。

**互換 alias 出力なし**: API レスポンスは新 key (`purchase_bonus_gap`) のみを返す。旧 key (`coupon_bonus_gap`) は出力されないため、本変更を pull したリリースで即時にダウンストリームを更新する必要がある。

## エンティティの追加

アップストリームが持つのは `user_daily_activities`（DAU）と `analytics_daily_rollups`（日次ロールアップ）のみ。
日次の事前集計が必要なら独自テーブルより先に**ロールアップフレームワークへのメトリクス登録を検討する**こと（上記セクション参照）。
それ以外の集計キャッシュ、スナップショット、ダッシュボード設定等が必要になった場合、`entities/` にテーブル定義を追加する。

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

## DAU（アクティブユーザー）系 API

`user_daily_activities`（1 ユーザー × 1 日 = 1 行、ON CONFLICT DO NOTHING で冪等 ingest）を一次データとする、訪問・アクティブ系の read 群。
「DAU / WAU / MAU」「ユーザーごとの訪問日数」「最もアクティブなユーザー」の問いは全てここで解く（userCounter のキーで再実装しない — userCounter README の決定ガイド参照）。

| 関数（dauAnalytics） | エンドポイント | 返すもの |
|---|---|---|
| `getDauDaily` | GET /api/admin/analytics/dau/daily | バケット別アクティブユーザー数（day=DAU / week=WAU / month=MAU） |
| `getDauSummary` | GET /api/admin/analytics/dau/summary | 期間サマリー（avg/max/min、前期比） |
| `getDauRanking` | GET /api/admin/analytics/dau/ranking | ユーザー別アクティブ日数ランキング |

### ランキング（getDauRanking）

- パラメータ: 日付範囲共通パラメータ + `limit`（既定 50、最大 200）/ `page`（1 始まり） + ユーザーフィルタ（roles / excludeDemo）
- レスポンス: `RankingResponse`（`items: [{ rank, userId, displayName, activeDays, lastActiveDate }]` + `total`）
- 並び順: activeDays DESC → lastActiveDate DESC → userId ASC（ページングが安定するよう決定的）
- `(user_id, activity_date)` ユニークのため `COUNT(*)` = 期間内アクティブ日数。`activity_date` index のレンジスキャン + GROUP BY で解決

### ユーザー単位ドリルダウン（userId パラメータ）

daily / summary は `userId` で単一ユーザーに絞り込める（他ドメインの分析 API と同じ共通パラメータ）:

- `dau/summary?userId=X` → `totalActiveRecords` = そのユーザーの期間内アクティブ日数
- `dau/daily?userId=X`（day 粒度） → 0/1 の系列（アクティビティカレンダー・ヒートマップ用途）

### クライアント / フック

- 記録（ingest）: `hooks/useDauTracker.ts`（1 日 1 回 `POST /api/activity/dau`）
- 読み取り: `services/client/dauAnalyticsClient.ts`（fetchDauDaily / fetchDauSummary / fetchDauRanking）+ `hooks/useDauDaily.ts` / `useDauSummary.ts` / `useDauRanking.ts`（SWR）。管理画面のダッシュボード・「アクティブユーザー」タブ等はこれらをそのまま利用する（画面 UI は下流の責務）

## ランキングAPI: ウォレット vs 購入

2つのランキングAPIは異なるデータソースを参照し、異なるユースケースに対応する。

| 観点 | wallet/ranking | purchase/ranking |
|---|---|---|
| データソース | wallet_histories | purchase_requests (status='completed') |
| 日付カラム | createdAt | completed_at |
| ソートパラメータ | `sortBy` | `sortBy` |
| sortBy 候補 | totalPurchase, totalConsumption, purchaseCount, netChange | totalCoinAmount, totalPaymentAmount, purchaseCount, avgPaymentAmount |
| レスポンス | 全指標を常に返す（sortBy はソート順のみ変更） | 全指標を常に返す（sortBy はソート順のみ変更） |
| ユーザー情報 | userId + displayName（users LEFT JOIN） | userId + displayName（users LEFT JOIN） |
| 追加フィルタ | — | paymentProvider |
| デフォルト件数 | 50（最大200） | 20（最大100） |

### 使い分け

- **サービス内通貨あり**: どちらも利用可能。コイン/ポイント増減の分析には wallet/ranking、決済金額の分析には purchase/ranking
- **直接決済のみ（ECサイト等）**: wallet_histories に購入レコードが存在しないため purchase/ranking のみ使用可能

## ウォレット系API: history 軸 vs state 軸

ウォレット分析は2つの軸で構成される。データソースが別なので両方共存する。

| 観点 | history 軸（wallet_histories） | state 軸（wallets） |
|---|---|---|
| データソース | 増減台帳の累積 | 現時点の保有スナップショット |
| 期間概念 | 日付範囲必須（dateFrom/dateTo/days） | スナップショットなので期間なし |
| walletType | optional（クロス集計可、単位は意味依存） | **必須**（型ごとに残高単位が異なる） |
| 提供 API | `/wallet-history/{daily,summary,balance}`, `/wallet/ranking` | `/wallet/state/{summary,ranking,distribution}` |
| 主なユースケース | 期間内の流入・流出、KPI推移 | 現在の流通量・保有者分布、リワード設計 |

### state 軸の追加要件・補足

- **walletType は必須クエリパラメータ**: 残高（balance）の単位は通貨によって意味が変わる（例: コイン枚数とポイント数は加算しても意味がない）。state 系では `walletType` 未指定はリクエストエラー。
- **保有者の定義**: `balance > 0` のユーザー。`locked_balance` は参考値として `totalLockedBalance` で別途返却する。
- **distribution の boundaries**: `purchase/distribution` と完全に同じ仕様。CSV、昇順、正整数、最大20個。境界外（balance < 先頭境界）は bucket=0 に集約。さらに完全な 0 残高ウォレットは別途 `zeroBalanceCount` として返す。
- **クライアント / フック**: `services/client/walletStateAnalyticsClient.ts` および `hooks/useWalletState{Summary,Ranking,Distribution}.ts` を提供済み。下流ではこれらをそのまま再利用する想定。
- **既定バケット値の扱い**: アップストリームでは保持しない。事業ごとに妥当なバケット値が異なるため、ダウンストリーム側の管理画面コンポーネント等で `boundaries` を組み立ててクライアント関数に渡すこと。
