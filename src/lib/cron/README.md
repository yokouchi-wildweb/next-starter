# cron 基盤

`/api/cron/*` 配下の定期タスク用 API ルートと、CLI からも同じタスクを呼ぶための共通基盤。

定期タスクの一覧は `src/registry/cronTaskRegistry.ts`（fork 独自分は `src/registry/forkCronTaskRegistry.ts`）が**唯一の正**。
dispatcher・個別 API ルート・CLI（`pnpm task`）がすべてここを読む。スケジューラ（`vercel.json`）には
**dispatcher だけ**を登録し、個々のタスクは登録しない。upstream がタスクを足しても fork は merge するだけで本番で動き始める
（`vercel.json` を手で追記する作業が無いので、配線漏れが構造的に起きない）。

CLI 側のランナーは `pnpm task <task-name>`（`scripts/tasks/run.ts`）。定期タスクに加えて、バックフィル・データ移行などの
**ワンショット運用タスク**も扱う。ワンショットは `scripts/tasks/run.ts` の `ONE_SHOT_TASKS` だけに書き、
レジストリ・API ルートには載せない（定期実行されてはいけないため）。

## 構成

- `types.ts` — タスク定義の型 `CronTaskDefinition` と頻度区分 `CRON_CADENCES`（`15m` / `hourly` / `daily`）
- `auth.ts` — 共通認証（`CRON_SECRET` の Bearer 検証）
- `createCronRoute.ts` — API ルート生成ファクトリ（`createCronRoute`、レジストリの定義から作る `createCronTaskRoute`）
- `createCronDispatchRoute.ts` — dispatcher ルート生成ファクトリ（下記）
- `vercelCrons.ts` — `vercel.json` の crons の生成・検査（純関数。`pnpm cron:generate` / `pnpm cron:check` / テストが使う）
- `runBudgetedBatches.ts` — 時間予算付き・再開可能バッチランナー（下記）
- `cronWiring.test.mjs` — 配線テスト（`pnpm test:cron-wiring`）
- `index.ts` — 公開エントリ

周辺: `src/registry/cronTaskRegistry.ts`（upstream のタスク）/ `src/registry/forkCronTaskRegistry.ts`（fork 所有・upstream は空）/
`src/config/app/cron-schedule.config.ts`（頻度区分ごとの時刻）/ `src/app/api/cron/dispatch/[cadence]/route.ts`（dispatcher）/
`scripts/cron/`（`cron:generate` / `cron:check`）

## 仕組み

```
vercel.json ── /api/cron/dispatch/<cadence> ──▶ dispatcher
                                                 │ レジストリから cadence が一致し enabled() が真のタスクを選ぶ
                                                 ├─▶ GET /api/cron/<task-a>   ← 各タスクは別の関数実行（並列 fan-out）
                                                 └─▶ GET /api/cron/<task-b>
```

- **頻度区分**: タスクは `cadence`（`15m` / `hourly` / `daily`）だけを宣言し、時刻は持たない。区分ごとの cron 式は
  `src/config/app/cron-schedule.config.ts`（UTC。既定: 15 分ごと / 毎時 10 分 / 毎日 18:00 UTC = 03:00 JST）
- **fan-out**: dispatcher は対象タスクの個別ルートを `CRON_SECRET` 付きで並列に呼ぶ。1 関数内で順に実行すると
  全タスクが 1 回分の maxDuration を分け合うため、別の関数実行にして各タスクが自分の maxDuration を持てるようにしている。
  呼び先のオリジンは `getAppBaseUrl()`（本番は `APP_BASE_URL` か `businessConfig.url`。Host ヘッダからは組み立てない）
- **enabled**: config だけを見る同期関数（DB に触れない）。false のタスクは dispatcher が呼ばない（無効な機能のコスト = ゼロ）。
  個別ルートを直接叩いた場合も本体を呼ばず `{ ok: true, skipped: true }` を返す。個人情報の retention prune は機能を後から
  無効にしても既存行を消し続ける必要があるため、enabled を付けず常に起動する
- **応答**: dispatcher は全タスク成功で 200、1 つでも失敗で 500 `{ ok: false, cadence, dispatched: [{ name, ok, status }], skipped }`

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

## 新しい定期タスクを追加する

`vercel.json` は触らない（dispatcher が起動する）。手順は 2 つだけで、漏れは `pnpm test:cron-wiring` が検出する。

### 1. レジストリに登録

upstream は `src/registry/cronTaskRegistry.ts` の `CORE_CRON_TASKS`、fork は `src/registry/forkCronTaskRegistry.ts` の
`FORK_CRON_TASKS` に足す（fork は upstream のファイルを編集しない）:

```ts
{
  name: "my-task",
  description: "何をするタスクか（pnpm task --list に出る。fork 独自タスクの文書はここが置き場）",
  cadence: "daily",
  enabled: () => MY_FEATURE_CONFIG.enabled, // 任意。config だけを見る
  run: async () => {
    const { runMyTask } = await import("@/features/myDomain/services/server/myTask");
    return await runMyTask();
  },
},
```

- `run` は動的 import にする（レジストリを読むだけで全タスクの依存を読み込まないため）
- 長い運用説明が要るなら、タスク本体のディレクトリの README に書いて `description` から参照する

### 2. 個別 API ルート（1 行）

```ts
// src/app/api/cron/my-task/route.ts
import { createCronTaskRoute } from "@/lib/cron";
import { getCronTask } from "@/registry/cronTaskRegistry";

export const maxDuration = 300; // 重い処理のときだけ

export const GET = createCronTaskRoute(getCronTask("my-task"));
```

`pnpm task my-task` は登録した時点で使える（`scripts/tasks/run.ts` がレジストリを読む）。
upstream のタスクなら、下の「cron タスクカタログ」にも追記する（fork 独自タスクは `description` で足りる）。

### `pnpm test:cron-wiring` が検査すること

- タスク名が一意（upstream と fork で同名にしない）・ケバブケース・`description` あり
- `src/app/api/cron/<name>/` のルートが全てレジストリにある（未登録 = dispatcher が起動しない）
- 登録済みタスクに `getCronTask("<name>")` を読む個別ルートがある
- `vercel.json.example` と（あれば）`vercel.json` が dispatcher だけを登録した形（個別エントリの併記 = 二重実行）

## cron タスクカタログ

upstream が提供する定期実行タスク（定義は `src/registry/cronTaskRegistry.ts`）。いずれも dispatcher が頻度区分に従って起動し、
`GET /api/cron/<task-name>` と `pnpm task <task-name>` からも同じ関数を呼べる。fork は登録作業なしで全タスクを受け取る。
「有効条件」があるタスクは条件を満たさない間は起動されない（コストゼロ）。無いタスクは常に起動され、機能未使用なら対象が無く即終わる。
レスポンスは `{ ok: true, ...result }`（下記の例は `...result` 部分の形）。

### `expire-pending-purchases`

期限切れ（`expires_at` 経過）の pending 購入リクエストを `expired` に遷移する。
`onExpire` フックを定義した purchase_type では副次テーブルの atomic クリーンアップも同時に実行される。

- 頻度: `15m`
- 結果: `{ expired: 12 }`
- 注意: onExpire 定義ありの purchase_type は per-row 処理になり件数に比例して時間がかかる。Vercel Hobby では 1 日 1 回になるため、期限切れの反映が最大 1 日遅れる

### `audit-log-prune`

`audit_logs` の retention_days を超過した行をバッチ削除する。`SKIP LOCKED` でバッチ反復するため書き込み tx を長時間ブロックしない。

- 頻度: `daily`
- 結果: `{ deletedCount: 3200, iterations: 4, truncated: false }`

### `audit-log-recover-dead-letter`

`audit_logs_failed`（bestEffort 記録の dead-letter）に溜まった行を `audit_logs` へ再投入する。一過性の書き込み失敗（DB 一時障害等）の救済用。
恒久的に再投入できない行（schema 不整合等）は残るため、件数が長期的に増えるなら手動調査する。

- 頻度: `hourly`
- 結果: `{ total: 5, recovered: 5, failed: 0, dryRun: false, errorSamples: [] }`

### `analytics-rollup-daily`

`analyticsRollupRegistry` に登録された全メトリクスについて、昨日を含む直近数日の日次ロールアップ（`analytics_daily_rollups`）を冪等に再計算する。
遅延到着データと実行漏れを自己修復する。当日の部分バケットは書き込まない（読み取り側がライブ計算でマージ）。

- 頻度: `daily`
- 結果: `{ metrics: [...] }`（メトリクスごとの結果）
- 詳細: `src/features/core/analytics/README.md` の「運用（cron / バックフィル）」

### `interaction-event-prune`

interactionTracking のイベント明細を保持期限経過後に削除する。累計・日次集計は消えない。

- 頻度: `daily`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/interactionTracking/README.md` の「cron の配線」

### `user-daily-counter-prune`

userCounter の日次行を保持期限経過後に削除する。累計（`user_counters`）は消えない。

- 頻度: `daily`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/userCounter/README.md` の「cron（日次カウンタの prune）」

### `user-login-event-prune`

`user_login_events`（IP 横断検索用の正規化テーブル）の retention_days を超過した行をバッチ削除する。件数増加が早いため日次で回す。

- 頻度: `daily`
- 結果: `{ deletedCount: 1500, iterations: 2, truncated: false }`
- 詳細: `src/features/core/userLoginEvent/README.md`

### `device-fingerprint-prune`

`device_fingerprints` の retention_days を超過した行をバッチ削除する。個人に紐づく識別情報のため無期限保持にしない。
機能未使用（`FINGERPRINT_CONFIG` 無効）なら対象が無く no-op。機能を後から無効にしても既存行を消すため、有効条件は付けていない。

- 頻度: `daily`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/deviceFingerprint/README.md`

### `fingerprint-challenge-access-prune`

`fingerprint_challenge_access_events`（本人がチャレンジを開いた日時 + IP + UA）の retention_days を超過した行をバッチ削除する。
親行の閲覧カウンタ（first/last_viewed_at / view_count）は集計値として残る。`FINGERPRINT_CONFIG.challenge.accessLog.enabled`（既定 false）が無効なら no-op。

- 頻度: `daily`
- 結果: `{ deletedCount, iterations, truncated }`
- 詳細: `src/features/core/fingerprintChallenge/README.md`

### `wallet-expire-lots`

有効期限切れウォレットロットの残額を没収する（残高減算 + wallet_histories 記録）。冪等・再実行安全。
`wallet-expiration.config.ts` で `expirationDays` + `sweepEnabled` を設定した通貨のみが対象。

- 頻度: `daily`
- 有効条件: `sweepEnabled` の通貨が 1 つ以上
- 結果: `{ sweptWallets: 120, expiredAmount: 45000, iterations: 1, truncated: false, requestBatchId: "..." }`
- 詳細: `src/features/core/wallet/README.md` の「有効期限（ロット管理）」

### `wallet-lots-prune`

消費し尽くしたウォレットロット（remaining = 0）を保持期間（デフォルト 30 日）経過後に物理削除する。
有効期限を有効化した（特に付与頻度が高い）プロジェクトでは `wallet_lots` の肥大化を防ぐため必須。

- 頻度: `daily`（`wallet-expire-lots` と同時に走る。当日没収された分は次回以降の対象）
- 有効条件: `expirationDays` を設定した通貨が 1 つ以上
- 結果: `{ deletedCount: 8000, iterations: 8, truncated: false }`

### `wallet-expiration-notice`

ウォレットの失効通知（失効予告 + 失効時の本通知）をメール / サービス内通知で送る。冪等（同じ対象には 1 回しか届かない）。
`wallet-expiration.config.ts` の通貨ごとの `notice` を設定した場合のみ動作する。
時間予算（240 秒、ルートは `maxDuration = 300`）内で送りきれなかった分は次回実行が続きから処理する。

- 頻度: `hourly`（実行が重なっても二重には届かない）
- 有効条件: いずれかの通貨に `notice` の設定がある
- 結果: `{ skipped: false, preExpiry: { sent, alreadySent, failed, exhausted, ... }, expired: { ... }, aborted: false }`
- 監視: `aborted: true` は送信の連続失敗による打ち切り（メール基盤の障害など）。`failed` が増えている場合は `message_dispatches` を確認
- 詳細: `src/features/core/wallet/README.md` の「失効通知（失効予告・失効時の本通知）」

### CLI 専用タスク（API ルートなし）

`scripts/tasks/run.ts` の `ONE_SHOT_TASKS` にのみ登録され、レジストリと `/api/cron/*` には載っていないタスク（dispatcher は起動しない）。

- `purchase-quota-cleanup` — 90 日より古い購入クォータ台帳を物理削除する定期メンテナンス（任意）。定期実行したい fork は `forkCronTaskRegistry.ts` に登録して個別ルートを足す（`ONE_SHOT_TASKS` と同名は不可なので別名にする）。詳細: `src/features/core/purchaseQuota/README.md` の「cron」
- ワンショット（**定期実行してはいけない**。導入時などに手動で 1 回だけ実行する）:
  - `wallet-lots-init` — ウォレット有効期限の導入時のデータ移行。再実行は全ユーザーの失効カウントをリセットする
  - `wallet-lots-init-from-history` — `wallet-lots-init` の代替（導入時に**どちらか一方だけ**実行）。付与履歴から実際の付与日でロットを復元し、既に期限を過ぎた分は次回の `wallet-expire-lots` で没収される。`-- --dry-run` で対象件数と没収見込み額を事前確認できる。詳細: `src/features/core/wallet/README.md` の「導入手順（ダウンストリーム）」
  - `user-name-dedup` — 表示名の一意性（`USER_NAME_CONFIG.unique`）有効化時に既存の重複表示名へサフィックスを付けて解消する。冪等。`-- --dry-run` で事前確認。詳細: `src/features/core/user/README.md` の「表示名 = ユーザー名（バリデーションと一意性）」
  - `user-status-history-backfill` — `user_status_histories` の過去分を retention 内の `audit_logs` から復元する。冪等。詳細: `src/features/core/user/README.md` の「ステータス遷移履歴」
  - `analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]` — 日次ロールアップの過去分を再計算する（遡及修正の再計算経路を兼ねる）。詳細: `src/features/core/analytics/README.md`

## スケジュールのセットアップ

### Vercel（推奨）

```bash
pnpm cron:generate --plan hobby   # Vercel Hobby: dispatcher 1 本（/api/cron/dispatch/all を 1 日 1 回）
pnpm cron:generate --plan pro     # Vercel Pro:   dispatcher 3 本（15m / hourly / daily）
```

`vercel.json` の `crons` だけを書き換える（他のキーと `/api/cron/` の外のエントリは残す。`/api/cron/*` の個別エントリは
二重実行防止のため消える）。生成した `vercel.json` をコミットし、Vercel の環境変数に `CRON_SECRET` を登録する
（Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を自動で付ける）。新規 fork は `/fork-init` がこれを済ませる。

- **再生成が要るとき**: プランを変えたとき・`cron-schedule.config.ts` の値を変えたときだけ。タスクの追加・削除では不要
- **Hobby の制約**: Vercel Hobby は 1 日 1 回より細かい cron を受け付けないため、`15m` / `hourly` のタスクも 1 日 1 回になる
  （`expire-pending-purchases` の期限切れ反映や `wallet-expiration-notice` の送信が最大 1 日遅れる）。困るなら Pro にする
- **事前検査**: `pnpm cron:check` が `vercel.json` の形を検査する（無い・dispatcher が無い・個別エントリが残っている → 失敗）。
  `pnpm deploy:all` はデプロイ前にこれを実行し、失敗したら何もデプロイしない
- **呼び先のオリジン**: dispatcher は `getAppBaseUrl()` に向けて個別ルートを呼ぶ。本番は `APP_BASE_URL` か `businessConfig.url` が
  実際の本番 URL であること（プレースホルダーのままだと dispatcher が 500 を返す）
- **確認**: デプロイ後、Vercel の Cron Jobs タブに dispatcher のエントリが出ていること。ログは `scope: "cron-dispatch"`（dispatcher）と
  `scope: "cron"`（各タスク）

### Vercel 以外（CLI）

任意のスケジューラから頻度区分ごとに `pnpm task --cadence <区分>` を呼ぶ（dispatcher と同じ役割。API ルートを経由しないので
`CRON_SECRET` は不要、DB 等の環境変数は必要）。区分内のタスクは順に実行され、1 つ失敗しても残りは実行して最後に exit 1。

```cron
# Docker + cron
*/15 * * * * cd /app && pnpm task --cadence 15m
10 * * * *   cd /app && pnpm task --cadence hourly
0 18 * * *   cd /app && pnpm task --cadence daily
```

```yaml
# GitHub Actions（日次だけ回す例。--cadence all なら全区分を 1 回で）
on:
  schedule:
    - cron: "0 18 * * *"
jobs:
  daily:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install && pnpm task --cadence daily
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

登録済みタスクの一覧（頻度・有効/無効・説明つき）は `pnpm task --list`。

## 認証

- 本番・preview: `Authorization: Bearer ${CRON_SECRET}` ヘッダ必須
- development: 認証バイパス（ローカル動作確認用）
- `CRON_SECRET` 未設定時は本番で fail-closed（401 を返す）

## 運用上の注意

- 失敗時は API ルートが 500 `{ ok: false, error }` を返し、stderr に JSON ログ（`scope: "cron"`）を出す。成功時も stdout に JSON ログ（`durationMs` + 結果）。CLI は `scope: "task-cli"` で同形式、失敗時は exit 1
- Vercel Cron は失敗を自動リトライしないため、失敗の監視はログ側で行う（dispatcher の 500 は配下のどれかの失敗。`dispatched` で特定できる）
