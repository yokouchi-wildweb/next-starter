# src/lib/task — ドメインのタスク・移行の型

`pnpm task <ドメイン>:<名前>` で走らせるドメインのタスク(繰り返しの運用コマンド・機能を有効にするたびの導入コマンド)と移行(notice が名指す 1 回きり)の定義の型。

- 入口: `src/lib/task/index.ts` だけ(中を外から読ませない)
- 公開: `type OneShotTask = { name, notice?, stopKeys?, run }`(`run` は重い依存を中で動的 import する)・`class TaskNotStartedError`(書き込み前に止まった印)・`taskIncomplete(result)` / `isTaskIncomplete`(予算で止まった印)・`class TaskRerunnableError`(書いた後だが打ち直してよい失敗)
- 依存: なし(features・棚・`@/wiring` を読まない)
- 使う側: タスクの定義 `src/features/<ドメイン>/scripts/{tasks,migrations}/<名前>.ts`、ランナー `scripts/runner/task/`(走査 `scan.mjs`・読み込み `discover.ts`・下準備 `prepare.ts`・実行の流れ `execute.ts`・記録の値 `record.ts`・記録の置き場 `store.ts`)
- 定期タスクの型は `src/lib/cron`(`CronTaskDefinition`)。定期タスクは `src/app/api/cron/<name>/task.ts` で平らな名前のまま

## タスク・移行を足す

持ち主のドメインの中に 1 ファイル置く(一覧ファイルは無い。上流も fork も同じ。fork 固有の物は fork 自身のドメインに置き、core のドメインには足さない)。

- 繰り返しの運用・導入: `src/features/<ドメイン>/scripts/tasks/<名前>.ts`(core は `src/features/core/<ドメイン>/scripts/tasks/`)
- 1 回きりの移行(notice が案内する物): `src/features/<ドメイン>/scripts/migrations/<名前>.ts`。`notice: "<案内する notice の id>"` が必須
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
- 使い方の誤り・対象の検証で書き込み前に止める時は `throw new TaskNotStartedError(...)`(記録は failed、止める鍵を取らない)

## 止まる置き方

`pnpm task` は次を全部並べて止める: ファイル名が kebab-case でない / 旧い fork の名前の印つきの名前 / 同じ名前が 2 つ / `task.name` が `<ドメイン>:<ファイル名>` と違う / 古い置き場 `scripts/tasks/` に残ったファイル(移し方を出す)。

## notice が案内するタスク

出荷前の notice(`.notices/<id>.md` で、まだ索引 `.notices/shipped/` に無い物)に書いた `pnpm task <名前>` は、その木に実在するタスク・移行・定期タスクでなければ `pnpm check notices` が止める(`scripts/workflow/notices/notices.test.mjs`)。出荷済みの notice の本文は見ない(書き換えない。その notice の版の木で読む)。

## 実行の記録(task_runs)

名指しの 1 回(`pnpm task <ドメイン>:<名前>`・人が名前を打った定期タスク)は毎回 core の taskRun ドメインの表 `task_runs` に 1 行残す(`src/features/core/taskRun/README.md`)。`pnpm task --due`(毎分の自動の回し)は記録しない。

- 記録 = 名前・種類・引数・開始と終了・結果・git の版と未コミットの印・実行者・段階・接続先(host と DB 名)・dry-run か・ファイルの中身のハッシュ
- 走る前に `running` の行を書く。書けなければ走らせない(表が無い = `pnpm db:push` の案内)。DB が未設定なら止める
- 走らせるのは `runAsSystem({ requestId: <行の id> })` の中(タスクは自分で runAsSystem を呼ばない。監査の行と記録が突き合わさる)
- 止める鍵: 移行は常に `migration:<notice の id>:<名前>`。タスクは `stopKeys(args)` を宣言した物だけ(例 `wallet:lots-init` と `wallet:lots-init-from-history` は通貨ごとに同じ `wallet-lots:<通貨>`)。同じ鍵の成功・結果不明・実行中の行があれば拒否して、その行を出す
- 結果不明: 止める鍵のある実行が走り出してから落ちた = `unknown`(自動では二度と走らない)。`TaskNotStartedError` は `failed`(打ち直せる)。確かめたら `pnpm task --resolve <runId> succeeded|failed`
- 予算で止まった: 大きな写しなどを `runBudgetedBatches`(`@/lib/cron`)で束ごとに進め、締切で止まった時は `return taskIncomplete({ ...途中の数 })`。記録は `incomplete`(鍵を取らない = 移行でも同じ命令をもう一度打てる)、終了コード 2(続きがある)。打ち直して続きから進むタスク(写した行を写し先で見分けられる冪等な物)だけが使う
- 打ち直してよい失敗: 冪等なタスクが自分で確かめて失敗とした時(例: 写しの後の照合が合わない)は `throw new TaskRerunnableError(message, result)`。記録は `failed`(鍵を取らない)で `result` も残る。冪等でないタスクは使わない(落ちれば結果不明にする)
- dry-run(引数 `--dry-run`)は記録に印を付け、鍵を取らず、鍵に止められない
- 立ち上げの例外: `task_runs` を作る最初の `pnpm db:push` と DB の無い初期化は記録なし(`pnpm task` を通らない)

## git に入れない移行(.local.ts)

下流に流さない緊急のデータ修正(運用のミス・トラブル)は、持ち主のドメインの `src/features/<ドメイン>/scripts/migrations/<名前>.local.ts` に置く(`.gitignore` に上流が 1 行。コミットしない)。名前は同じ `<ドメイン>:<名前>`、`notice:` は持たない。型検査・lint(`tools-no-db-write` は移行として扱う = 直接の SQL・db を許す)・記録はふつうの移行と同じに効く。

- 事前のレビューの代わり: 同じ中身(ファイルの sha256)の dry-run が成功してから本実行できる(`pnpm task <名前> -- --dry-run` → `pnpm task <名前>`)。中身を変えたら dry-run からやり直し
- 止める鍵 `migration:local:<名前>:<sha256>`: 同じ中身は二度と本実行しない
- 実行した中身の全文を dry-run も本実行も `task_runs.source` に残す
- 本実行の後、ランナーが作業の記録の下書き `docs/journal/<日付>--<fork_id>--local-migration-<ドメイン>-<名前>.md` を書く(コミットしない)。人が「なぜ・確かめたこと」を書き足してコミットする
- dry-run を自分で扱うのはファイルの役目(`process.argv` の `--dry-run` を見て書き込まない)
- コミット・ステージされていれば門 ship(`pnpm check local-migrations`、/ship)が止める。終わったら人が消す
- 下流にも要ると分かったら `.local` を外して `notice:` を付ける(ふつうの移行になる)
