# src/lib/task — ドメインのタスク・移行の型

`pnpm task <ドメイン>:<名前>` で走らせるドメインのタスク(繰り返しの運用コマンド・機能を有効にするたびの導入コマンド)と移行(notice が名指す 1 回きり)の定義の型。

- 入口: `src/lib/task/index.ts` だけ(中を外から読ませない)
- 公開: `type OneShotTask = { name, run }`(`run` は重い依存を中で動的 import する)
- 依存: なし(features・棚・`@/wiring` を読まない)
- 使う側: タスクの定義 `src/features/<ドメイン>/scripts/{tasks,migrations}/<名前>.ts`、ランナー `scripts/runner/task/`(走査 `scan.mjs`・読み込み `discover.ts`・下準備 `prepare.ts`)
- 定期タスクの型は `src/lib/cron`(`CronTaskDefinition`)。定期タスクは `src/app/api/cron/<name>/task.ts` で平らな名前のまま

## タスク・移行を足す

持ち主のドメインの中に 1 ファイル置く(一覧ファイルは無い。上流も fork も同じ。fork 固有の物は fork 自身のドメインに置き、core のドメインには足さない)。

- 繰り返しの運用・導入: `src/features/<ドメイン>/scripts/tasks/<名前>.ts`(core は `src/features/core/<ドメイン>/scripts/tasks/`)
- 1 回きりの移行(notice が案内する物): `src/features/<ドメイン>/scripts/migrations/<名前>.ts`
- 名前 = `<ドメイン>:<名前>`(ドメイン = フォルダ名、`<名前>` = kebab-case のファイル名)。`task.name` もこの形

```ts
import type { OneShotTask } from "@/lib/task";

export const task: OneShotTask = {
  name: "wallet:lots-init", // <ドメイン>:<ファイル名>
  run: async () => {
    const { doIt } = await import("@/features/core/wallet/services/server/doIt"); // 依存は動的 import
    return { done: await doIt() };
  },
};
```

- 引数は `process.argv.slice(3)`(`pnpm task <名前> -- <引数>`、`--` は除く)
- タスクの間で共有する部品は同じフォルダの `lib.<名前>.ts`(タスクに数えない)。テスト `*.test.ts` も隣に置く
- 書き方の決まり(lint `import-boundaries/tools-no-db-write`): `scripts/tasks/` は DB を直接書く部品(`@/lib/drizzle` の db・表の定義・生 SQL・ドライバ)を読まずドメインのサービスを通す。直接の SQL が要る物は `scripts/migrations/`(例外)
- 定期実行はされない(`vercel.json` に載らない)。機能の門に掛からない(閉じたドメインのタスクも走る。定期タスクは閉じていれば飛ばす: `src/lib/cron/README.md`)
- 実行は指定の名前のファイルだけを読み込む。`pnpm task --list` はファイル名だけを見る

## 止まる置き方

`pnpm task` は次を全部並べて止める: ファイル名が kebab-case でない / 旧い fork の名前の印つきの名前 / 同じ名前が 2 つ / `task.name` が `<ドメイン>:<ファイル名>` と違う / 古い置き場 `scripts/tasks/` に残ったファイル(移し方を出す)。

## notice が案内するタスク

出荷前の notice(`.notices/<id>.md` で、まだ索引 `.notices/shipped/` に無い物)に書いた `pnpm task <名前>` は、その木に実在するタスク・移行・定期タスクでなければ `pnpm check notices` が止める(`scripts/workflow/notices/notices.test.mjs`)。出荷済みの notice の本文は見ない(書き換えない。その notice の版の木で読む)。
