# cron 基盤

`/api/cron/*` 配下の定期タスク用 API ルートと、CLI からも同じタスクを呼ぶための共通基盤。

CLI 側のランナーは `pnpm task <task-name>`（`scripts/tasks/run.ts`）。この統合ランナーは
定期実行（cron）タスクだけでなく、バックフィル・データ移行などの**ワンショット運用タスク**も扱う。
ワンショットタスクは下記手順のうち「2. CLI エントリ」のみを配線し、
API ルートとスケジュール登録は行わない（定期実行されてはいけないため）。

## 構成

- `auth.ts` — 共通認証（`CRON_SECRET` の Bearer 検証）
- `createCronRoute.ts` — API ルート生成ファクトリ
- `runBudgetedBatches.ts` — 時間予算付き・再開可能バッチランナー（下記）
- `index.ts` — 公開エントリ

## 時間予算付きバッチ（maxDuration で殺されないために）

serverless では 1 回の実行が maxDuration（Vercel 既定 300s）で途中 kill される。
「毎回全件を舐める」タスクは成長とともに必ずここに当たり、**毎回途中で死んで一度も完走しない**状態になる。
無制限に増えるデータを扱う cron は、最初から次の 2 つで組む:

- `runBudgetedBatches({ deadline, fetchNext, processChunk, onChunkDone, maxItems?, maxChunks? })`
  - 締切をチャンク開始前に判定し、処理中のチャンクは完走させてから抜ける
  - `onChunkDone` で進捗を永続化（チェックポイント前進など）すれば、kill されても次回は続きから
  - 戻り値 `{ processed, chunks, exhausted, budgetExhausted, stopReason }` をそのままレスポンスに載せる
- `createDeadline(budgetMs)` — `budgetMs` は maxDuration そのものではなく
  「maxDuration − 1 チャンクの最大所要時間 − 余裕」（300s なら 240_000 程度）

進捗の永続化先は `@/features/cronCheckpoint`（`getCheckpoint` / `advanceCheckpoint`、単調前進）。
「ソースの `updated_at` から read-model を差分更新する」典型パターンは、これらを合成済みの
`@/features/incrementalRefresh`（`createIncrementalRefresh`）を使う。

## 新しい cron タスクを追加する

### 1. API ルート

```ts
// src/app/api/cron/<task-name>/route.ts
import { createCronRoute } from "@/lib/cron";
import { runMyTask } from "@/features/...";

export const GET = createCronRoute({
  name: "my-task",
  handler: async () => {
    const result = await runMyTask();
    return { processed: result.count };
  },
});
```

### 2. CLI エントリ

`scripts/tasks/run.ts` の TASKS に追加:

```ts
const TASKS: Record<string, () => Promise<unknown>> = {
  "expire-pending-purchases": () => ...,
  "my-task": () => import("@/features/...").then((m) => m.runMyTask()),
};
```

### 3. vercel.json.example にスケジュール登録

リポジトリルートの `vercel.json.example` に追記する（**忘れやすいので注意**。
下流プロジェクトはこれをコピーした `vercel.json` を持ち、Vercel がデプロイ時に自動で cron を稼働させる）:

```json
{
  "crons": [{ "path": "/api/cron/my-task", "schedule": "*/15 * * * *" }]
}
```

導入時1回だけの手動タスク（データ移行等）は vercel.json.example に**載せない**（定期実行されてはいけないため）。

### 4. カタログに記載

本 README の「[cron タスクカタログ](#cron-タスクカタログ)」にタスクの説明・推奨スケジュール・レスポンス例を追記する。
下流プロジェクトはこのカタログを見てスケジュール登録を判断する。

## cron タスクカタログ

コアが提供する定期実行タスク。いずれも `GET /api/cron/<task-name>` と `pnpm task <task-name>` の両方から同じ関数を呼ぶ。
推奨スケジュールは `vercel.json.example` と一致させてある（prune 系は深夜帯で時刻をずらしている）。
レスポンスは `{ ok: true, ...result }`（下記の例は `...result` 部分の形）。

### `expire-pending-purchases`

期限切れ（`expires_at` 経過）の pending 購入リクエストを `expired` に遷移する。
`onExpire` フックを定義した purchase_type では副次テーブルの atomic クリーンアップも同時に実行される。

- スケジュール: `*/15 * * * *`
- 結果: `{ expired: 12 }`
- 注意: onExpire 定義ありの purchase_type は per-row 処理になり件数に比例して時間がかかる。溜まりやすい運用ならスケジュール間隔を短縮する

### `audit-log-prune`

`audit_logs` の retention_days を超過した行をバッチ削除する。`SKIP LOCKED` でバッチ反復するため書き込み tx を長時間ブロックしない。

- スケジュール: `0 3 * * *`
- 結果: `{ deletedCount: 3200, iterations: 4, truncated: false }`

### `audit-log-recover-dead-letter`

`audit_logs_failed`（bestEffort 記録の dead-letter）に溜まった行を `audit_logs` へ再投入する。一過性の書き込み失敗（DB 一時障害等）の救済用。
恒久的に再投入できない行（schema 不整合等）は残るため、件数が長期的に増えるなら手動調査する。

- スケジュール: `0 * * * *`
- 結果: `{ total: 5, recovered: 5, failed: 0, dryRun: false, errorSamples: [] }`

### `analytics-rollup-daily`

`analyticsRollupRegistry` に登録された全メトリクスについて、昨日を含む直近数日の日次ロールアップ（`analytics_daily_rollups`）を冪等に再計算する。
遅延到着データと実行漏れを自己修復する。当日の部分バケットは書き込まない（読み取り側がライブ計算でマージ）。

- スケジュール: `15 0 * * *`（日付確定後）
- 結果: `{ metrics: [...] }`（メトリクスごとの結果）
- 詳細: `src/features/core/analytics/README.md` の「運用（cron / バックフィル）」

### `interaction-event-prune`

interactionTracking のイベント明細を保持期限経過後に削除する。累計・日次集計は消えない。

- スケジュール: `30 3 * * *`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/interactionTracking/README.md` の「cron の配線」

### `user-daily-counter-prune`

userCounter の日次行を保持期限経過後に削除する。累計（`user_counters`）は消えない。

- スケジュール: `45 3 * * *`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/userCounter/README.md` の「cron（日次カウンタの prune）」

### `user-login-event-prune`

`user_login_events`（IP 横断検索用の正規化テーブル）の retention_days を超過した行をバッチ削除する。件数増加が早いため日次で回す。

- スケジュール: `0 4 * * *`
- 結果: `{ deletedCount: 1500, iterations: 2, truncated: false }`
- 詳細: `src/features/core/userLoginEvent/README.md`

### `device-fingerprint-prune`

`device_fingerprints` の retention_days を超過した行をバッチ削除する。個人に紐づく識別情報のため無期限保持にしない。
機能未使用（`FINGERPRINT_CONFIG` 無効）なら対象が無く no-op。

- スケジュール: `15 4 * * *`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/deviceFingerprint/README.md`

### `fingerprint-challenge-access-prune`

`fingerprint_challenge_access_events`（本人がチャレンジを開いた日時 + IP + UA）の retention_days を超過した行をバッチ削除する。
親行の閲覧カウンタ（first/last_viewed_at / view_count）は集計値として残る。`FINGERPRINT_CONFIG.challenge.accessLog.enabled`（既定 false）が無効なら no-op。

- スケジュール: `20 4 * * *`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/fingerprintChallenge/README.md`

### `wallet-expire-lots`

有効期限切れウォレットロットの残額を没収する（残高減算 + wallet_histories 記録）。冪等・再実行安全。
`wallet-expiration.config.ts` で `expirationDays` + `sweepEnabled` を設定した通貨のみが対象で、未設定（デフォルト）なら即終了の no-op（登録したままでも害はない）。

- スケジュール: `30 4 * * *`
- 結果: `{ sweptWallets: 120, expiredAmount: 45000, iterations: 1, truncated: false, requestBatchId: "..." }`
- 詳細: `src/features/core/wallet/README.md` の「有効期限（ロット管理）」

### `wallet-lots-prune`

消費し尽くしたウォレットロット（remaining = 0）を保持期間（デフォルト 30 日）経過後に物理削除する。
有効期限を有効化した（特に付与頻度が高い）プロジェクトでは `wallet_lots` の肥大化を防ぐため必須。機能未使用なら no-op。

- スケジュール: `45 4 * * *`（`wallet-expire-lots` の後）
- 結果: `{ deletedCount: 8000, iterations: 8, truncated: false }`

### `wallet-expiration-notice`

ウォレットの失効通知（失効予告 + 失効時の本通知）をメール / サービス内通知で送る。冪等（同じ対象には 1 回しか届かない）。
`wallet-expiration.config.ts` の通貨ごとの `notice` を設定した場合のみ動作し、未設定ならクエリを発行せず `skipped: true` で即終了。
時間予算（240 秒、ルートは `maxDuration = 300`）内で送りきれなかった分は次回実行が続きから処理する。

- スケジュール: `10 * * * *`（送信量が多ければ頻度を上げる。メール送信の時間帯を絞るならスケジュール側で制限）
- 結果: `{ skipped: false, preExpiry: { sent, alreadySent, failed, exhausted, ... }, expired: { ... }, aborted: false }`
- 監視: `aborted: true` は送信の連続失敗による打ち切り（メール基盤の障害など）。`failed` が増えている場合は `message_dispatches` を確認
- 詳細: `src/features/core/wallet/README.md` の「失効通知（失効予告・失効時の本通知）」

### CLI 専用タスク（API ルートなし）

`scripts/tasks/run.ts` の TASKS にのみ登録され、`/api/cron/*` と `vercel.json.example` には載っていないタスク。

- `purchase-quota-cleanup` — 90 日より古い購入クォータ台帳を物理削除する定期メンテナンス（任意）。Vercel Cron で回す場合は API ルートを別途追加する。詳細: `src/features/core/purchaseQuota/README.md` の「cron」
- ワンショット（**定期実行してはいけない**。導入時などに手動で 1 回だけ実行する）:
  - `wallet-lots-init` — ウォレット有効期限の導入時のデータ移行。再実行は全ユーザーの失効カウントをリセットする
  - `wallet-lots-init-from-history` — `wallet-lots-init` の代替（導入時に**どちらか一方だけ**実行）。付与履歴から実際の付与日でロットを復元し、既に期限を過ぎた分は次回の `wallet-expire-lots` で没収される。`-- --dry-run` で対象件数と没収見込み額を事前確認できる。詳細: `src/features/core/wallet/README.md` の「導入手順（ダウンストリーム）」
  - `user-name-dedup` — 表示名の一意性（`USER_NAME_CONFIG.unique`）有効化時に既存の重複表示名へサフィックスを付けて解消する。冪等。`-- --dry-run` で事前確認。詳細: `src/features/core/user/README.md` の「表示名 = ユーザー名（バリデーションと一意性）」
  - `user-status-history-backfill` — `user_status_histories` の過去分を retention 内の `audit_logs` から復元する。冪等。詳細: `src/features/core/user/README.md` の「ステータス遷移履歴」
  - `analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]` — 日次ロールアップの過去分を再計算する（遡及修正の再計算経路を兼ねる）。詳細: `src/features/core/analytics/README.md`

## スケジュールのセットアップ

### Vercel（推奨）

リポジトリルートの `vercel.json.example` を `vercel.json` にコピーし、Vercel のプロジェクト設定で環境変数 `CRON_SECRET` を登録する
（Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を自動で付ける）。使わないタスクは `vercel.json` から外してよい。

### Vercel 以外（CLI）

任意のスケジューラから `pnpm task <task-name>` を呼ぶ（API ルートを経由しないので `CRON_SECRET` は不要、DB 等の環境変数は必要）。

```cron
# Docker + cron
*/15 * * * * cd /app && pnpm task expire-pending-purchases
```

```yaml
# Kubernetes CronJob
spec:
  schedule: "*/15 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: expire-pending
            image: myapp:latest
            command: ["pnpm", "task", "expire-pending-purchases"]
```

```yaml
# GitHub Actions
on:
  schedule:
    - cron: "*/15 * * * *"
jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install && pnpm task expire-pending-purchases
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

登録済みタスクの一覧は `pnpm task --list`。

## 認証

- 本番・preview: `Authorization: Bearer ${CRON_SECRET}` ヘッダ必須
- development: 認証バイパス（ローカル動作確認用）
- `CRON_SECRET` 未設定時は本番で fail-closed（401 を返す）

## 運用上の注意

- 失敗時は API ルートが 500 `{ ok: false, error }` を返し、stderr に JSON ログ（`scope: "cron"`）を出す。成功時も stdout に JSON ログ（`durationMs` + 結果）。CLI は `scope: "task-cli"` で同形式、失敗時は exit 1
- Vercel Cron は失敗を自動リトライしないため、失敗の監視はログ側で行う
