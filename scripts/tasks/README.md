# scripts/tasks(pnpm task)

`pnpm task <名前>` のランナー(`run.ts`)と、ワンショット・任意タスクの受け口。定期タスクは `src/app/api/cron/<name>/task.ts`(`src/lib/cron/README.md`)。

定期タスクは機能の門に従う: 住所 `/api/cron/<name>` を規則が閉じていれば、`--due` でも名前指定でも本体を呼ばずに飛ばし(`skipped: true, reason: "closed", rule` をログに出して exit 0)、`--list` に `[closed: <規則>]` と出す(判定 = `scripts/cron/discover.ts` の `closedBy`、門番の `gate.path`)。ワンショット・任意タスクは門に掛からない。

## タスクを足す

`scripts/tasks/<名前>.ts`(上流も fork も同じ。名前に fork の印は付けない)を 1 つ置く。一覧ファイルは無く、`run.ts`・`discover.ts`・`types.ts` 以外の直下のファイルが全部タスク。

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
- 失敗: 旧い fork の名前の印つきの名前(印なしの名前への改名と移し方 = 共有の棚の印の移行の notice を案内する)/ 名前の形 / cron と同じ名前 / `task.name` とファイル名の違い。上流と同じ単位名の fork の追加(`x.ts` と `x/index.ts`)は `pnpm ownership:check` の unit-clash
- 実行は指定の名前のファイルだけを読み込む。`pnpm task --list` はファイル名だけを見る
- タスク間で使う部品は `_shared/` に置く(直下でないので走査しない)
- 所有: `scripts/tasks/*.ts` は intake の生成区画の add 行(fork が足すのは可、上流のタスクの書き換えは違反)
