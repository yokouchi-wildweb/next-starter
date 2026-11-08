# taskRun(pnpm task の実行の記録)

`pnpm task` の名指しの 1 回(ドメインのタスク・移行・人が名前を打った定期タスク)を 1 行ずつ残す表と、その読み書きの関数。止める鍵(二度流すと困る物を自動で二度走らせない)と結果不明の土台。HTTP ルート・管理画面は持たない(登録表の access は `INTERNAL_ONLY`)。常に開いている(機能の門で閉じない)。

- 書き手: タスクのランナー `scripts/runner/task` だけ(流れ: `scripts/runner/task/execute.ts`、使い方: `src/lib/task/README.md`「実行の記録」)
- 記録しない物: `pnpm task --due`(毎分の自動の回し)・Vercel Cron の HTTP 呼び出し・機能が閉じて飛ばした定期タスク

## データモデル

table: `task_runs`(1 実行 = 1 行)

- `id uuid` … 実行の id。`runAsSystem` の `requestId` にも渡す(監査の行の `context.request_id` と突き合わせる)
- `name` … `<ドメイン>:<名前>`(定期タスクは平らな名前、データ操作は `data:<command>:<domain>`) | `kind` … `task` / `migration` / `cron` / `data`(`pnpm ops data` の import / update / delete、`scripts/operations/data/README.md`)
- `args jsonb` … `pnpm task <名前>` の後ろの引数 | `dry_run` … 引数に `--dry-run` があったか
- `status` … `running` → `succeeded` / `failed` / `unknown`
  - `failed` = 書き込みの前に止まった(`TaskNotStartedError`)、または止める鍵の無い実行の失敗、dry-run の失敗
  - `unknown` = 止める鍵のある実行が走り出してから落ちた(どこまで書いたか分からない)
  - `running` のまま残った行(落ちた・殺された)は結果不明と同じに鍵を持つ
- `stop_keys text[]` … 止める鍵。dry-run でない `running` / `succeeded` / `unknown` の行が持つ鍵と同じ鍵の実行は拒否される
- `result jsonb` / `error` … タスクの返り値・失敗の文
- `git_sha` / `git_dirty`(未コミットの変更があったか)/ `actor`(OS のユーザー名@ホスト名)/ `stage`(`@/lib/appEnv`)/ `db_target`(接続先の host と DB 名だけ、資格情報は持たない)/ `file_hash`(タスクのファイルの sha256)
- `source` … git に入れない移行(`.local.ts`)の中身の全文(dry-run も本実行も。ほかの実行は null)
- `started_at` / `finished_at` / `resolved_at`(人が `pnpm task --resolve` で書き直した時)

## 関数(`@/features/core/taskRun/services/server`)

- `startRun(input)` … `running` の行を書く(書けなければランナーは走らせない)
- `finishRun(id, { status, result, error })` … `running` の行にだけ結果を書く
- `findKeyHolders(keys)` … 鍵を持つ行を新しい順に
- `findDryRunOf(name, fileHash)` … 同じ名前・同じ中身の成功した dry-run の行(git に入れない移行の本実行の条件)
- `resolveRun(id, "succeeded" | "failed", note)` … `running` / `unknown` の行を人が確かめた結果に書き直す(`succeeded` = 鍵を持ち続ける / `failed` = 鍵を放して打ち直せる)

## 立ち上げ

表は `pnpm db:push` で作る(その最初の db:push と DB の無い初期化は記録なしの例外)。表が無いと `pnpm task` は走らず `pnpm db:push` を案内する。

テスト: `pnpm test --db src/features/core/taskRun`(開発 DB に `test:` の行を作って消す)・`pnpm test scripts/runner/task`(DB なし)
