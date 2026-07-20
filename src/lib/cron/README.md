# cron 基盤

`/api/cron/*` 配下の定期タスク用 API ルートと、CLI からも同じタスクを呼ぶための共通基盤。

CLI 側のランナーは `pnpm task <task-name>`（`scripts/tasks/run.ts`）。この統合ランナーは
定期実行（cron）タスクだけでなく、バックフィル・データ移行などの**ワンショット運用タスク**も扱う。
ワンショットタスクは下記手順のうち「2. CLI エントリ」のみを配線し、
API ルートとスケジュール登録は行わない（定期実行されてはいけないため）。

## 構成

- `auth.ts` — 共通認証（`CRON_SECRET` の Bearer 検証）
- `createCronRoute.ts` — API ルート生成ファクトリ
- `index.ts` — 公開エントリ

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
