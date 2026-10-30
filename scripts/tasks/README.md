# scripts/tasks(pnpm task)

`pnpm task <名前>` のランナー(`run.ts`)と、ワンショット・任意タスクの受け口。定期タスクは `src/app/api/cron/<name>/task.ts`(`src/lib/cron/README.md`)。

## タスクを足す

`scripts/tasks/<名前>.ts`(fork は `<名前>.<fork の名前>.ts`)を 1 つ置く。一覧ファイルは無く、`run.ts`・`discover.ts`・`types.ts` 以外の直下のファイルが全部タスク。

```ts
import type { OneShotTask } from "./types";

export const task: OneShotTask = {
  name: "my-task", // ファイル名の <名前> と同じ
  run: async () => {
    const { doIt } = await import("@/features/x/services/server/doIt"); // 依存は動的 import
    return { done: await doIt() };
  },
};
```

- 定期実行はされない(`vercel.json` に載らない)
- 失敗: 宣言に無い fork の名前 / 名前の形 / 同じ名前のファイルが 2 つ / cron と同じ名前 / `task.name` とファイル名の違い
- 実行は指定の名前のファイルだけを読み込む。`pnpm task --list` はファイル名だけを見る
- タスク間で使う部品は `_shared/` に置く(直下でないので走査しない)
- 所有: `scripts/tasks/*.*.ts` は intake の受け口
