# incrementalRefresh（read-model の時間予算付き差分更新）

「ソーステーブルの更新から派生するスナップショット/read-model テーブル」を、
serverless の maxDuration 内で **差分で** 最新化する cron タスクのファクトリ。

`@/lib/cron` の `runBudgetedBatches`（締切をチャンク境界で判定する再開可能ループ）と
`@/features/cronCheckpoint`（単調ウォータマーク）を合成した完成品。
集計式・スナップショットのスキーマ・どのソースを見るかは消費側ドメインの責務で、
ここはドメインを持たない。

## いつ使うか

- 管理画面一覧などが読む「ユーザーごとの集計スナップショット」を cron で作っている
- 全件再計算が O(総ユーザー数) で、成長とともに maxDuration（300s 等）を超え始めた
  → 一度超えると **毎晩途中 kill されてテーブル全体が恒久的に古くなる**（下流で実際に起きた障害）

該当するなら、全件再計算を捨てて本ファクトリの 3 層構成に置き換える:

| 層 | 役割 | 反応速度 | 部品 |
|---|---|---|---|
| 1. event-driven | 業務 TX 完了直後に対象 id を再計算 | 即時 | `@/lib/userDirty`（既存・変更不要） |
| 2. dirty 走査 | ソースの `updated_at` ウォータマークから「変わった id」だけ再計算 | cron 間隔（15 分等） | 本ファクトリ dirty phase |
| 3. trickle | read-model の最古から少しずつ全件をなめる安全網 | 数日で一巡 | 本ファクトリ trickle phase |

層 1 が取りこぼしても層 2 が拾い、層 2 が構造的に拾えない変化（`updated_at` が動かない集計元・非 HTTP 経路）は層 3 が自己修復する。

## API

import: `import { createIncrementalRefresh } from "@/features/incrementalRefresh/services/server"`

```ts
const runner = createIncrementalRefresh({
  name: "user-metrics-refresh",              // cron_checkpoints.name
  sources: [                                 // 「このテーブルの行が更新されたら、その id を再計算」
    { table: UserTable,    idColumn: UserTable.id,          updatedAtColumn: UserTable.updatedAt },
    { table: WalletTable,  idColumn: WalletTable.userId,    updatedAtColumn: WalletTable.updatedAt },
    { table: UserItemTable, idColumn: UserItemTable.userId, updatedAtColumn: UserItemTable.updatedAt,
      where: sql`${UserItemTable.deletedAt} IS NULL` },
  ],
  recompute: (userIds) => recomputeUserMetrics(userIds),   // 冪等。id は text 化済み
  overlapMarginMs: 120_000,                  // 既定 2 分。想定される最長 TX より大きく
  dirtyChunkSize: 200,                       // 既定 200
  dirtyLimitPerRun: 5000,                    // 省略時は予算のみで制御
  initialCheckpoint: new Date(0),            // 既定。初回は全件を（複数回に分けて）バックフィル
  trickle: {
    table: UserMetricsTable,
    idColumn: UserMetricsTable.userId,
    orderByColumn: UserMetricsTable.computedAt, // recompute が必ず更新するカラム
    batchSize: 100,                             // 既定 100
    maxPerRun: 1000,                            // 既定 1000
  },
});

// cron / CLI から同じ引数で呼ぶ
const result = await runner({ budgetMs: 240_000 });
```

戻り値（そのまま cron のレスポンス JSON に載せられる）:

```json
{
  "dirtyProcessed": 1830, "dirtyChunks": 10, "dirtyExhausted": true,
  "trickleProcessed": 400, "trickleStopReason": "deadline",
  "checkpointAt": "2026-09-04T03:15:00.000Z", "previousCheckpointAt": "2026-09-04T03:00:00.000Z",
  "budgetExhausted": true, "durationMs": 238112
}
```

## 動作の詳細

### dirty phase

1. `since = checkpoint − overlapMarginMs`
2. `sources` を `UNION ALL` して `updated_at > since` の行を集め、`GROUP BY id` の
   `MAX(updated_at)` 昇順・`id` 昇順で `dirtyChunkSize` 件ずつ取得（keyset ページング。
   2 ページ目以降は各ソースの下限を cursor 時刻に引き上げ、`HAVING (MAX(updated_at), id) > (cursor)` で同時刻タイを切る）
3. チャンクごとに `recompute(ids)` → `advanceCheckpoint(name, min(チャンク最大 updated_at, 実行開始時刻))`
   - 実行開始後の更新は走査に含まれた保証が無いので、実行開始時刻を上限にする
   - 途中 kill されても「advance 済みチャンクまでは完了」。次回は `checkpoint − margin` から再開
4. 対象を使い切ったら `advanceCheckpoint(name, 実行開始時刻)`

`overlapMarginMs` は「`updated_at` は走査前に採番されたのにコミットが走査後になった行」を
次回拾うための重なり。想定される最長トランザクションより大きく取る（大きいほど毎回の再処理量が増える）。

### trickle phase

残り予算で `trickle.table` を `orderByColumn ASC NULLS FIRST` の順に `batchSize` 件ずつ `recompute`。
`recompute` が `orderByColumn` を更新する前提なので、次の取得は自然に次の行へ進む。
更新されない場合は同じ id が返り続けるため、無進捗を検出して `trickleStopReason: "noProgress"` で打ち切り warn を出す。

### 予算

`budgetMs` は maxDuration そのものではなく、「maxDuration − 1 チャンクの最大所要時間 − 起動/後片付けの余裕」。
締切はチャンク開始前にしか判定されず、処理中のチャンクは完走させる。目安: maxDuration 300s → 240_000。

### 並走

排他ロックは持たない。`recompute` が冪等・チェックポイントが単調（GREATEST）なので、
スケジューラの重複起動があっても壊れない（同じ id を二重に再計算するだけ）。
厳密な排他が必要なら消費側で `pg_try_advisory_lock` 等を handler の外側に足す。

## 消費側の配線レシピ

### 1. ソーステーブルに `updated_at` インデックス

dirty 走査は各ソースの `updated_at > since` をレンジ走査する。各ソースに `(updated_at)` の index を張る
（消費側ドメインの `entities/drizzle.ts`）。

### 2. read-model に `computed_at`

trickle の `orderByColumn`。`recompute` が必ず `now()` に更新する。NULL = 未計算（最優先で処理される）。

### 3. サービス

```ts
// src/features/userMetrics/services/server/refresh.ts
import { createIncrementalRefresh } from "@/features/incrementalRefresh/services/server";

export const runUserMetricsRefresh = createIncrementalRefresh({ ...上記... });
```

### 4. cron ルート + CLI + スケジュール（`src/lib/cron/README.md` の 4 点セット）

```ts
// src/app/api/cron/user-metrics-refresh/route.ts
import { createCronRoute } from "@/lib/cron";
import { runUserMetricsRefresh } from "@/features/userMetrics/services/server/refresh";

export const maxDuration = 300;

export const GET = createCronRoute({
  name: "user-metrics-refresh",
  handler: () => runUserMetricsRefresh({ budgetMs: 240_000 }),
});
```

```ts
// scripts/tasks/run.ts
"user-metrics-refresh": async () => {
  const { runUserMetricsRefresh } = await import("@/features/userMetrics/services/server/refresh");
  return await runUserMetricsRefresh({ budgetMs: 240_000 });
},
```

```json
{ "path": "/api/cron/user-metrics-refresh", "schedule": "*/15 * * * *" }
```

`vercel.json` の `functions` で該当ルートの `maxDuration` も 300 にする。

### 5. 既存の全件再計算からの移行

- 旧タスク（`recomputeAllUserMetrics` 等）のスケジュールを外す
- 初回は `initialCheckpoint` 既定（epoch）で全件が dirty 扱いになり、予算ごとに分割されて数回の実行で追いつく。
  即時に追いつかせたいなら `pnpm task user-metrics-refresh` を追いつくまで繰り返す
- 遡及修正後にやり直す: `resetCheckpoint("user-metrics-refresh", <修正前の時刻>)`（`@/features/cronCheckpoint`）

## 制約・非対象

- Drizzle/Neon（PostgreSQL）専用。Firestore ソースは対象外
- `sources[].idColumn` と read-model の id は `::text` で突き合わせる（uuid / text 混在可）
- 「削除された行の id」は `updated_at` が動かないと dirty にならない。論理削除（`deleted_at` 更新で `updated_at` も更新）なら拾える。物理削除は trickle が拾うか、`recompute` 側で存在しない id の行を消す
- 高頻度イベント（テレメトリ級）の集計には向かない（COUNTING セクションの NOT_for と同じ）
