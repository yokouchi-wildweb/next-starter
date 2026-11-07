# cron 基盤

`/api/cron/*` 配下の定期タスク用 API ルートと、CLI からも同じタスクを呼ぶための共通基盤。

**1 タスク = 1 フォルダ** `src/app/api/cron/<name>/`。一覧ファイル（レジストリ）は持たない。
API ルート・CLI（`pnpm task`）・`vercel.json` の生成は、どれもこのフォルダを走査して同じ定義を読む。
upstream / fork / さらに下流の Tier も、タスクを足すときはフォルダを 1 つ足すだけで、共有ファイルを編集しない。

CLI 側のランナーは `pnpm task <task-name>`（`scripts/runner/task/run.ts`）。定期タスクに加えて、バックフィル・データ移行などの
**ワンショット運用タスク**も扱う。ワンショットは `scripts/tasks/<name>.ts` に 1 ファイルずつ置き(`scripts/tasks/README.md`)、
`src/app/api/cron/` には置かない（定期実行されてはいけないため）。

## 構成

- `types.ts` — タスク定義の型 `CronTaskDefinition`
- `cronExpression.ts` — cron 式の検証・照合（`isValidCronExpression` / `isAtMostDailySchedule` / `matchesCronExpression`）
- `auth.ts` — 共通認証（`CRON_SECRET` の Bearer 検証）
- `createCronRoute.ts` — API ルート生成ファクトリ（`createCronRoute`、task.ts の定義から作る `createCronTaskRoute`）。省略可の依存 `gate`（住所 → 閉か）で機能の門を受ける。route.ts は直接読まず、門番を結んだ `@/wiring/cronRoute` を使う
- `vercelCrons.ts` — `vercel.json` の crons の生成・検査（純関数）
- `discover.ts` — task を探す処理（`src/app/api/cron/<name>/` の走査・`task.override.ts` の反映・`listCronTaskDirs` / `loadCronTasks` / `scheduledCronTasks`）。node 用の 2 つ目の入口 `@/lib/cron/discover`（node:fs を使う。画面からは読まない）。門番は読まず、閉じているかは呼ぶ側が `closedBy` で渡す。生成器・検査（`scripts/structure/cron`）と `pnpm task` が共有する
- `runBudgetedBatches.ts` — 時間予算付き・再開可能バッチランナー（下記）
- `index.ts` — 公開エントリ

周辺: `src/app/api/cron/<name>/{task.ts,route.ts}`（各タスク）・`task.override.ts`（fork の上書き、任意）/ `src/wiring/cronRoute.ts`（門番を結んだ `createCronTaskRoute`）/
`scripts/structure/cron/`（`discover.ts` = `@/lib/cron/discover` に門番を結ぶ呼び手、`pnpm generate cron` / `pnpm check cron`、`cronWiring.test.mjs` = `pnpm test scripts/structure/cron/cronWiring.test.mjs`）

## 仕組み

```
src/app/api/cron/<name>/
  task.ts   … cronTask = { name, description, schedule, enabled?, run }（run はドメインの関数を動的 import で呼ぶだけ）
  route.ts  … export const GET = createCronTaskRoute(cronTask)（@/wiring/cronRoute から）

pnpm generate cron ── フォルダを走査 ──▶ vercel.json の crons（タスクごとに 1 エントリ）
Vercel Cron ── 時刻どおりに各 /api/cron/<name> を直接呼ぶ
```

- **処理本体はドメインに置く**: task.ts は「どの関数をいつ呼ぶか」の配線だけ。業務ロジックは `features/**/services/server` に置く
- **schedule**: 5 フィールドの cron 式（UTC）を自由に書く（毎分 `* * * * *`、固定時刻 `55 14 * * *` = JST 23:55 など）。
  vercel.json にはそのまま入る。upstream の日次タスクは 18:00 UTC（03:00 JST）から 5 分ずつずらしてある
- **fork による上書き**: upstream のタスクの時刻を変える・外すときは、同じフォルダに fork が `task.override.ts` を置く（下記「upstream のタスクを外す・時刻を変える」）。
  upstream の task.ts は編集しない（merge で衝突する）
- **期限つきのものを片付けるタスク**: `--plan hobby` では 1 日 1 回になるので、「期限直後に必ず消える」と説明しない
  （例: `storage-sweep`。ファイルのアップロード権はアプリの期限後も cloud 側でしばらく生きうる。src/features/core/storageObject/README.md「掃除」）
- **毎分など短い間隔のタスク**: 実行中（最大 maxDuration）に次の回が始まりうる。同じ対象を二重に処理しない作りにする
  （処理対象を DB の条件付き更新や次回実行時刻で取り合う等）。1 分より短い間隔は Vercel Cron では書けない（realtimeRoom 等の領域）
- **機能の門（自動）**: タスクの住所は名前から組んだ `/api/cron/<name>`。閉じられる機能のタスクは、その住所を機能の規則の
  `pathPatterns`（`src/featureGate/rules/<名前>.ts`）に載せるだけでよい。規則が閉じていると、route は本体を呼ばずに
  `{ ok: true, skipped: true, reason: "closed" }` を返し（proxy が先に 404 にする。route の判定は proxy を通らない呼び出しの安全網）、
  `pnpm task` は `--due` でも名前指定でも飛ばし、`pnpm generate cron` は vercel.json に載せない（機能を閉じた・開いたら再生成する）。
  判定はどれも門番の `gate.path`（route = `src/wiring/cronRoute.ts`、CLI と生成 = `scripts/structure/cron/discover.ts` の `closedBy`）。
  fork のタスクも同じ（自分の規則の pathPatterns に住所を書く）。task.ts に機能の入切（`gate.enabled` など）は書かない
- **enabled**: 機能以外の追加の実行条件（例: 失効を有効にした通貨があるか）。config だけを見る同期関数（DB に触れない）。
  false のときルートは本体を呼ばず `{ ok: true, skipped: true, reason: "disabled" }` を返す。vercel.json には載る（値を変えても再生成は要らない）。
  個人情報の retention prune は機能を後から無効にしても既存行を消し続ける必要があるため、門の規則にも enabled にも載せない
- **配線漏れの防止**: `vercel.json` は人が書かない。タスクの増減で生成結果とずれると、Vercel 上のビルド
  （`pnpm build` の冒頭の門 `pnpm check --gate=build` が cron の検査を `--vercel-build` で回す）と `pnpm live` 系(`pnpm live`・`pnpm live:room`・`pnpm live:all`)が止まる。漏れたまま本番が動き続けることはない

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

フォルダを 1 つ足し、`vercel.json` を再生成する。漏れは `pnpm test scripts/structure/cron/cronWiring.test.mjs` と Vercel 上のビルドが検出する。

### 1. task.ts

```ts
// src/app/api/cron/my-task/task.ts
import type { CronTaskDefinition } from "@/lib/cron";
import { MY_FEATURE_CONFIG } from "@/config/app/my-feature.config";

export const cronTask: CronTaskDefinition = {
  name: "my-task", // フォルダ名と同じ
  description: "何をするタスクか（pnpm task --list に出る）",
  schedule: "0 18 * * *", // UTC。毎日 03:00 JST
  // 任意。機能以外の追加条件だけ（機能の入切は規則の pathPatterns に "/api/cron/my-task" を書く）。config だけを見る
  enabled: () => MY_FEATURE_CONFIG.reminders.length > 0,
  run: async () => {
    const { runMyTask } = await import("@/features/myDomain/services/server/myTask");
    return await runMyTask();
  },
};
```

- 閉じられる機能のタスクなら、その機能の規則の `pathPatterns` に `/api/cron/my-task` を足す（上の「機能の門」）
- `run` は動的 import にする（`pnpm generate cron` や `pnpm task --list` が task.ts を読むだけで DB などの依存を読み込まないため）
- ドメイン名からサービスを引く処理に登録表を渡すときは、`run` の中で `src/wiring/domainRegistry.ts` を動的 import して渡す（例: storage-sweep の `lookupService`）。wiring を import してよいのは cron のフォルダでは task.ts だけ（task.override.ts は不可。`pnpm test src/wiring/wiring.test.mjs`）
- 長い運用説明は、処理本体があるドメインの README に書く

### 2. route.ts（1 行）

```ts
// src/app/api/cron/my-task/route.ts
import { createCronTaskRoute } from "@/wiring/cronRoute"; // 門番を結んだ版（@/lib/cron の作り手は lint cron-route-via-wiring で不可）
import { cronTask } from "./task";

export const maxDuration = 300; // 重い処理のときだけ

export const GET = createCronTaskRoute(cronTask);
```

### 3. vercel.json を再生成

```bash
pnpm generate cron -- --plan <hobby|pro>
```

`pnpm task my-task` はフォルダを置いた時点で使える。タスクを消すときもフォルダを消して再生成する。
upstream でタスクを足す・消すときは、fork 向けに `pnpm generate cron` を `required_actions` に書いた notice を同じ commit で出す(`/ship` で出荷すると判定と起票まで行う)
（CLAUDE.md `cron_wiring`）。

### `pnpm test scripts/structure/cron/cronWiring.test.mjs` が検査すること

- cron のフォルダに `task.ts` と `route.ts` があり、`route.ts` が `./task` の `cronTask` を `@/wiring/cronRoute` の `createCronTaskRoute` で読む
- `task.ts` の `name` = フォルダ名・ケバブケース、`schedule` が正しい cron 式、`description` あり、`enabled` が boolean を返す
- `task.override.ts`（あれば）が `schedule` / `disabled` だけを持ち、`schedule` が正しい cron 式で、同じフォルダに `task.ts` がある
- README と `task.ts` / `task.override.ts` が `@/lib/cron` から import する名前を、`src/lib/cron/index.ts` がすべて export している
- `vercel.json`（あれば）が task.ts（+ task.override.ts、閉じた機能のタスクを除く）からの生成結果と一致する
- 機能の門: 閉じた住所のタスクは `closedBy` が付いて生成と検査から外れる、route の作り手は閉なら認証の後・本体の前に skipped
- task.ts が門番（`@/featureGate`）を読まない（機能の入切は住所で自動。Tier1 は失敗、fork は一覧を出すだけ）

閉じられる機能のフォルダを import する task.ts の住所が規則の `pathPatterns` に載っているかは、`FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies` の常時実行の入口の検査が見る（`src/featureGate/README.md`）。

## upstream のタスクを外す・時刻を変える（fork）

upstream のタスクのフォルダに `task.override.ts` を置く。upstream は `task.override.ts` を作らない（fork 所有。`_components/` と同じ扱い）ので、
merge で衝突しない。上書きしたいタスクの分だけ置けばよい。

```ts
// src/app/api/cron/audit-log-prune/task.override.ts
import type { CronTaskOverride } from "@/lib/cron";

export const cronOverride: CronTaskOverride = {
  schedule: "0 20 * * *", // task.ts の schedule の代わりに使う（UTC）
  // disabled: true,      // 定期実行しない
};
```

- `schedule`: vercel.json と `pnpm task --due` はこちらの時刻を使う
- `disabled: true`: vercel.json に載らず、`pnpm task --due` でも動かない。`pnpm task <name>` の手動実行はできる。
  機能を閉じたいだけなら要らない（閉じた機能のタスクは自動で外れる）。機能以外の理由で外すときに使う
- 置いた・変えたら `pnpm generate cron -- --plan <hobby|pro>` で再生成する（忘れると Vercel のビルドで止まる）
- upstream がそのタスクを消すと `task.override.ts` だけが残り、`pnpm check cron` / `pnpm test scripts/structure/cron/cronWiring.test.mjs` が失敗する → `task.override.ts` も消す
- 名前は `task.ts` の一部の上書き = 他の上書きと同じ `<対象>.override.ts` の形（`scripts/structure/extensions/README.md`「override」）。旧名の `override.ts` が残っていると `pnpm check cron` / `pnpm generate cron` / `pnpm task` が改名を案内して止まる（`git mv <dir>/override.ts <dir>/task.override.ts`、中身はそのまま）
- 個人情報を含むデータの削除タスク（`audit-log-prune` / `user-login-event-prune` / `device-fingerprint-prune` /
  `fingerprint-challenge-access-prune`）を外すと保持期限が守られなくなる。外すのは、その機能を使っておらず対象テーブルが空のときだけ
- `pnpm task --list` に上書きの状態（`(task.override.ts)` / `[off: task.override.ts]`）と、機能が閉じたタスクの `[closed: <規則>]` が出る

## タスク一覧

`pnpm task --list` が `src/app/api/cron/*/task.ts` から一覧（schedule・有効/無効・説明）を出す。各タスクの詳細と運用上の注意は、
処理本体があるドメインの README（`src/features/core/{auditLog,userLoginEvent,deviceFingerprint,fingerprintChallenge,interactionTracking,userCounter,analytics,purchaseRequest,wallet}/README.md`）を見る。

## CLI 専用タスク（定期実行しない）

`scripts/tasks/<name>.ts` にだけあり、`src/app/api/cron/` にフォルダが無いタスク（vercel.json に載らない = 定期実行されない）。

- `purchase-quota-cleanup` — 90 日より古い購入クォータ台帳を物理削除する定期メンテナンス（任意）。定期実行したい fork は `src/app/api/cron/<別名>/` に task.ts と route.ts を足す（`scripts/tasks/` のタスクと同名は不可）。詳細: `src/features/core/purchaseQuota/README.md` の「cron」
- ワンショット（**定期実行してはいけない**。導入時などに手動で 1 回だけ実行する）:
  - `wallet-lots-init` — ウォレット有効期限の導入時のデータ移行。対象通貨の指定が必須（`-- --wallet-type <通貨>` か `-- --all`）。再実行は対象通貨の全ユーザーの失効カウントをリセットする
  - `wallet-lots-init-from-history` — `wallet-lots-init` の代替（導入時に**どちらか一方だけ**実行）。付与履歴から実際の付与日でロットを復元し、既に期限を過ぎた分は次回の `wallet-expire-lots` で没収される。対象通貨の指定は `wallet-lots-init` と同じく必須。`--dry-run` で対象件数と没収見込み額を事前確認できる。詳細: `src/features/core/wallet/README.md` の「導入手順（ダウンストリーム）」
  - `user-name-dedup` — 表示名の一意性（`USER_NAME_CONFIG.unique`）有効化時に既存の重複表示名へサフィックスを付けて解消する。冪等。`-- --dry-run` で事前確認。詳細: `src/features/core/user/README.md` の「表示名 = ユーザー名（バリデーションと一意性）」
  - `user-status-history-backfill` — `user_status_histories` の過去分を retention 内の `audit_logs` から復元する。冪等。詳細: `src/features/core/user/README.md` の「ステータス遷移履歴」
  - `analytics-rollup-backfill -- <metricKey> [--from YYYY-MM-DD] [--to YYYY-MM-DD]` — 日次ロールアップの過去分を再計算する（遡及修正の再計算経路を兼ねる）。詳細: `src/features/core/analytics/README.md`

## スケジュールのセットアップ

### Vercel（推奨）

```bash
pnpm generate cron -- --plan hobby   # Vercel Hobby: 全タスクを 1 日 1 回
pnpm generate cron -- --plan pro     # Vercel Pro:   task.ts の schedule どおり
```

`vercel.json` の `crons` だけを書き換える（他のキーと `/api/cron/` の外のエントリは残す）。生成した `vercel.json` をコミットし、
Vercel の環境変数に `CRON_SECRET` を登録する（Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を自動で付ける）。
新規 fork は `/fork-init` がこれを済ませる。upstream は `vercel.json` を持たない（各リポジトリが自分のフォルダから生成する）。

- **再生成が要るとき**: タスクのフォルダが増減したとき・schedule を変えたとき（どちらも upstream からの merge を含む）・`task.override.ts` を置いた・変えたとき・プランを変えたとき
- **検査**: `pnpm check cron` が `vercel.json` と生成結果を突き合わせる（無い・エントリの漏れ・消えたタスクの残骸・時刻の手書き → 失敗）。
  `pnpm build` は Vercel 上（`VERCEL=1`）でだけ冒頭にこれを実行し、`pnpm live` 系もデプロイ前に実行する。
  定期タスクを意図して 1 本も動かさないデプロイ（デモ環境等）だけは環境変数 `SKIP_CRON_CHECK=1` で外す
- **上限**: Vercel の cron は 1 プロジェクト 100 本まで（全プラン共通）。Hobby は 1 日 1 回より細かい式でデプロイが失敗し、
  起動時刻も指定時刻から最大 59 分ずれる。`--plan hobby` は 1 日 1 回より細かいタスクを 19:00 UTC から 5 分ずつずらして 1 日 1 回にし、
  生成時に警告を出す（`expire-pending-purchases` の期限切れ反映や `wallet-expiration-notice` の送信が最大 1 日遅れる）。困るなら Pro にする
- **確認**: デプロイ後、Vercel の Cron Jobs タブにタスクごとのエントリが出ていること（手動実行もそこからできる）

### Vercel 以外（CLI）

任意のスケジューラから `pnpm task --due` を**毎分 1 本**だけ呼ぶ。今の分（UTC）に `schedule` が一致するタスクを CLI が判定して順に実行する
（API ルートを経由しないので `CRON_SECRET` は不要、DB 等の環境変数は必要）。1 つ失敗しても残りは実行して最後に exit 1。

```cron
# Docker + cron
* * * * * cd /app && pnpm task --due
```

毎分起動できないスケジューラ（GitHub Actions は最短 5 分）では `--due` は使えない。個別に `pnpm task <name>` を登録する。
登録済みタスクの一覧（schedule・有効/無効・説明つき）は `pnpm task --list`。

## 認証

- 本番・preview: `Authorization: Bearer ${CRON_SECRET}` ヘッダ必須
- development: 認証バイパス（ローカル動作確認用）
- `CRON_SECRET` 未設定時は本番で fail-closed（401 を返す）

## 運用上の注意

- 失敗時は API ルートが 500 `{ ok: false, error }` を返し、stderr に JSON ログ（`scope: "cron"`）を出す。成功時も stdout に JSON ログ（`durationMs` + 結果）。CLI は `scope: "task-cli"` で同形式、失敗時は exit 1
- Vercel Cron は失敗を自動リトライしないため、失敗の監視はログ側で行う
