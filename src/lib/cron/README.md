# cron 基盤

`/api/cron/*` 配下の定期タスク用 API ルートと、CLI からも同じタスクを呼ぶための共通基盤。

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

`scripts/cron/run.ts` の TASKS に追加:

```ts
const TASKS: Record<string, () => Promise<unknown>> = {
  "expire-pending-purchases": () => ...,
  "my-task": () => import("@/features/...").then((m) => m.runMyTask()),
};
```

### 3. vercel.json にスケジュール登録

下流プロジェクトの `vercel.json` に:

```json
{
  "crons": [{ "path": "/api/cron/my-task", "schedule": "*/15 * * * *" }]
}
```

## cron タスクカタログ

コア提供の cron 一覧は `docs/reference/cron-tasks.md` を参照。

## 認証

- 本番・preview: `Authorization: Bearer ${CRON_SECRET}` ヘッダ必須
- development: 認証バイパス（ローカル動作確認用）
- `CRON_SECRET` 未設定時は本番で fail-closed（401 を返す）
