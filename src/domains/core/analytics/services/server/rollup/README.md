# analytics/services/server/rollup

## Overview

- 日次ロールアップ（事前集計）のフレームワーク（このフォルダ）と、そのメトリクスの点 `analyticsRollupMetrics`（差す側の `<ドメイン>/plugs/analyticsRollupMetrics/`、常に読む一覧）
- 「確定した過去日の値を `analytics_daily_rollups` に日次で焼き込み、読み取りは PK ルックアップ + 当日だけライブ計算」に置き換えることで、**サービス運用年数に比例して重くなる集計**（特にランニングバランス系のベースライン全履歴スキャン）を構造的に解消する。
- 役割分担: フレームワーク（保存・cron・マージ読み）= 上流、メトリクス定義（compute）= 受け口の項目。上流の項目は連絡の日まとめ（`messaging<Measure>.ts` の 11 本、中身は `services/server/messagingAnalytics/rollup.ts`）だけ
- 使う時の決まりは札 .claude/rules/items/domains/analytics.md にある。受け口の仕組み: `scripts/structure/extensions/README.md`

### 採用判断

- 使う: 全履歴スキャンを伴うランニングバランス系列（流通コイン残高・未消化賞品価値等）、期間が長くなるほど重いダッシュボード時系列
- 使わない: 既に単純な `GROUP BY date` 1クエリで十分軽い集計（まず `withAnalyticsCache` だけで足りないか検討）。ロールアップはテーブル・cron・バックフィル運用を伴うため、キャッシュより導入コストが高い
- 位置づけ: ロールアップ行は**ソーステーブルから再計算可能な派生キャッシュ**。真実のソースにしない（COUNTING 基盤の userCounter / interactionTracking はイベント発生時の一次記録であり役割が異なる）

## Usage

### メトリクスの登録

- 自分のドメインの `plugs/analyticsRollupMetrics/<名前>.ts` に `export const metric: RollupMetricConfig` を置き、`pnpm generate extensions`

```typescript
// 例: src/domains/wallet/analytics/rollup/coinClosingBalance.ts
import { sql } from "drizzle-orm";
import { db } from "@/lib/drizzle";
import type { RollupMetricConfig } from "@/domains/core/analytics/services/server/rollup";

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
// <ドメイン>/plugs/analyticsRollupMetrics/coinClosingBalance.ts に置き pnpm generate extensions
import { coinClosingBalanceMetric } from "@/domains/wallet/analytics/rollup/coinClosingBalance";

export const metric = coinClosingBalanceMetric;
```

依存する機能が閉じている間など、メトリクスを外したいときは `enabled: () => boolean` を足す（省略 = 常に有効）。
false の間は登録が無いのと同じ: `listRollupMetricConfigs`・日次 cron・バックフィルの対象から外れ、`getRollupMetricConfig` / `readRolledDailySeries` で名指しすると 404 の DomainError。
compute が `[]` を返すだけだと一覧に残り、空の行を焼き込み続ける。key の重複は無効の項目も含めて例外。

```typescript
export const metric: RollupMetricConfig = {
  ...gachaRevenueMetric,
  enabled: () => gate.enabled("gacha"), // server 側なので gate(@/featureGate)を読める
};
```

ディメンション分割が必要な場合は `compute` が `[{ value, dims: { walletType: "coin" } }, ...]` のように複数行を返す
（dims はフラットなオブジェクトのみ。同一日内で dims の重複は不可）。

### 運用（cron / バックフィル）

- 日次: Vercel Cron が 1 日 1 回呼ぶ（`vercel.json` のエントリは `pnpm generate cron` が生成）。手動は `pnpm task analytics-rollup-daily` または `GET /api/cron/analytics-rollup-daily`。昨日を含む直近3日（メトリクスの `lookbackDays` が長ければその日数 = max(`lookbackDays`, 実行の日数)）を冪等に再計算し、遅延到着データと実行漏れを自己修復する。遅れて足されるデータ（開封・既読など）を持つメトリクスだけ `lookbackDays` を長くする
- 新規メトリクス登録時・遡及修正時: `pnpm task analytics:rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]`（from 省略時 = `backfillFrom`、to 省略時 = 昨日）
- **集計除外の遡及適用**: 専用機構はない。compute が除外を織り込んでいる前提で、該当期間のバックフィルを再実行すれば整合する（書き込みは日単位 delete → insert の冪等 upsert）
- 書き込み後は `invalidateAnalyticsCache()` で集計のキャッシュタグを積む（cron の route の中なら要求の終わりに全インスタンスから消える。`pnpm task` のバックフィルは入口の外で記録の 1 行、確定済みの寿命 12 時間で切れる）

### 読み取り

```typescript
import { readRolledDailySeries } from "@/domains/core/analytics/services/server/rollup";

const series = await readRolledDailySeries({
  metricKey: "wallet.coin_closing_balance",
  range, // resolveDateRange の戻り値
  // dims: { walletType: "coin" },  // 指定時は完全一致、省略時はディメンション横断で合算
});
// → { dateFrom, dateTo, granularity, history: [{ date, value }], includesLiveBucket }
```

## API

### kind

| kind | 意味 | 週/月集約 | 欠損日 | 例 |
|---|---|---|---|---|
| `flow` | 日ごとの発生量 | 日の合計 | 0 | 日次売上、ガチャ収支 |
| `snapshot` | 日末時点の状態量（クロージング値） | バケット末日の値 | 直前値キャリー | 流通コイン残高、未消化賞品価値 |

`snapshot` は読み取り時に「範囲開始前の直近行」を1行だけベースラインとして先読みするため、
ランニングバランスでも全履歴スキャンが発生しない。

### 読み取りの仕様

- 確定日はロールアップ行から、当日は `compute` のライブ実行値をマージ（`includeLive: false` で無効化可）
- granularity は `day` / `week` / `month`（`hour` は `GranularityNotSupportedError`。日次行が最小単位のため）
- `range.timezone` はメトリクスの timezone（既定 `Asia/Tokyo`）と一致必須（バケット境界の整合のため）
- `withAnalyticsCache` と合成可能（キャッシュが手前、ロールアップが奥。当日を含む範囲は短い寿命の側に自動判定されるため相性が良い）
- 既存のライブ集計サービスのシグネチャは変更しない。メトリクス単位で読み取りパスをロールアップへ**段階的に**置き換える

### 連絡の日まとめ（`messaging.*`、上流の組み込み）

- 鍵 = 1 指標 1 つ: `messaging.targeted` / `sent` / `failed` / `suppressed` / `delivered` / `bounced` / `complained` / `opened` / `clicked` / `read` / `unsubscribed`（kind flow）。`skipped_no_address` / `skipped_throttled` は日まとめにしない（集計の口 `/api/admin/analytics/messaging/**` だけ）
- dims = `{ channel, messageKey, category }`（配信停止の結び付きの無い行は `messageKey` null）。数え方は集計の口と同じ（送信した日の cohort、配信停止は止めた日）。項目 = `src/domains/core/messaging/plugs/analyticsRollupMetrics/messaging<Measure>.ts`（1 行、中身は `services/server/messagingAnalytics/rollup.ts`）
- `lookbackDays`: 送信の数・配信停止 = 既定（3）、到達・bounce・苦情 7、開封・クリック 14、既読 30（送った日に遅れて足される。配達の行の保持 90 日より短い）
- enabled: 規則 `messagingAnalytics` が開の時（集計の口と同じ）。`opened` / `clicked` は計測 `messagingTracking` も開の時だけ。条件は受け口の項目が値に書く（常時実行の入口の検査が項目の値を見る）
- 1 日分の読み込み（4 つの問い合わせ）は同じ日を計算する指標で共有する（短い memo）
- 読み方: `readRolledDailySeries({ metricKey: "messaging.sent", range, dims? })`。dims は完全一致なので、送信チャンネル × 定義 × カテゴリーの 1 組を指すか、省略して日ごとに合算する（定義だけで絞る読み口は無い。要るなら fork が行を読んで足す）。配達の行が保持で消えた後も日まとめの値は残る
- 新しく開いた時の過去分: `pnpm task analytics:rollup-backfill -- messaging.<measure> --from YYYY-MM-DD`（配達の行の残る 90 日以内が意味のある範囲）
