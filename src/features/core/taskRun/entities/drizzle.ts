// src/features/core/taskRun/entities/drizzle.ts

import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * pnpm task の実行の記録(1 実行 = 1 行。HTTP・管理画面には出さない)。
 * - 書き手は scripts/runner/task だけ(走る前に running の行、終わって結果)。行を書けなければタスクを走らせない
 * - stop_keys: 止める鍵。dry-run でない running / succeeded / unknown の行が持つ鍵と同じ鍵の実行は拒否される
 * - id は runAsSystem の requestId にも渡す(監査の行と突き合わせる)
 * - db_target は接続先の host / DB 名だけ(パスワード・ユーザー名は持たない)
 */
export const TaskRunTable = pgTable(
  "task_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** <ドメイン>:<名前>、定期タスクは平らな名前 */
    name: text("name").notNull(),
    /** task | migration | cron(TASK_RUN_KINDS) */
    kind: text("kind").notNull(),
    /** pnpm task <名前> の後ろの引数 */
    args: jsonb("args").$type<string[]>().notNull(),
    dryRun: boolean("dry_run").notNull(),
    /** running | succeeded | failed | unknown | incomplete(TASK_RUN_STATUSES) */
    status: text("status").notNull(),
    stopKeys: text("stop_keys").array().default([]).notNull(),
    result: jsonb("result"),
    error: text("error"),
    gitSha: text("git_sha"),
    /** 未コミットの変更があったか(git が無ければ null) */
    gitDirty: boolean("git_dirty"),
    /** OS のユーザー名@ホスト名 */
    actor: text("actor").notNull(),
    /** 段階(@/lib/appEnv) */
    stage: text("stage").notNull(),
    dbTarget: text("db_target"),
    /** タスクのファイルの中身の sha256 */
    fileHash: text("file_hash"),
    /** git に入れない移行(.local.ts)の中身の全文(ほかの実行は null。事前のレビューの代わりに残す) */
    source: text("source"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** 人が結果を確かめて書き直した時(pnpm task --resolve) */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("task_runs_name_started_idx").on(t.name, t.startedAt.desc()),
    index("task_runs_stop_keys_idx").using("gin", t.stopKeys),
  ],
);
