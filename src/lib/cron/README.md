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

`docs/reference/cron-tasks.md` にタスクの説明・推奨スケジュール・レスポンス例を追記する。
下流プロジェクトはこのカタログを見てスケジュール登録を判断する。

## cron タスクカタログ

コア提供の cron 一覧は `docs/reference/cron-tasks.md` を参照。

## 認証

- 本番・preview: `Authorization: Bearer ${CRON_SECRET}` ヘッダ必須
- development: 認証バイパス（ローカル動作確認用）
- `CRON_SECRET` 未設定時は本番で fail-closed（401 を返す）
