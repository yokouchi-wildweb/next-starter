# src/lib/task — ワンショット・任意タスクの型

`pnpm task <名前>` で走らせるワンショット・任意タスク(バックフィル・データ移行・開発の補助)の定義の型。

- 入口: `src/lib/task/index.ts` だけ(中を外から読ませない)
- 公開: `type OneShotTask = { name, run }`(`run` は重い依存を中で動的 import する)
- 依存: なし(features・棚・`@/wiring` を読まない)
- 使う側: タスクの定義 `scripts/tasks/<name>.ts`(`./types` の中継から読む。中継は計画書 07 で定義をドメインへ移す時に消す)、ランナー `scripts/runner/task/`(`discover.ts`)
- 定期タスクの型は `src/lib/cron`(`CronTaskDefinition`)
