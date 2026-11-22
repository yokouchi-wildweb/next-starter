// src/domains/core/messaging/scripts/migrations/merge-dispatch-vars.ts
// 送信の列 embedded_values(DB のテンプレートの専用の値)を vars へまとめる(D202: 埋め込み情報の値は 1 つの列)。db:push の前に必ず 1 回走らせる。
// 手順: pnpm task messaging:merge-dispatch-vars → pnpm db:push(embedded_values と system_template を消す)→ pnpm db:push:check(差分 0)
// push を先にすると embedded_values の値が失われる(テンプレートの送信の組み直し・同じ内容で送るが値を読めない)。
// 冪等: 写した行の embedded_values は null にする(写しと null にするのは 1 つの UPDATE)。列が無ければ何もしない。

import type { OneShotTask } from "@/lib/task";

/** 列があるか */
export const COLUMN_EXISTS_SQL = `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'message_dispatches' AND column_name = 'embedded_values'`;
/** 値のある行だけ vars へ重ねて写し、写した行の embedded_values を空にする(テンプレートの送信の vars は {} なので鍵は重ならない) */
export const MERGE_SQL = `UPDATE message_dispatches SET vars = COALESCE(vars, '{}'::jsonb) || embedded_values, embedded_values = NULL WHERE embedded_values IS NOT NULL`;

export const task: OneShotTask = {
  name: "messaging:merge-dispatch-vars",
  notice: "20261122-134000-messaging-records",
  run: async () => {
    const { db } = await import("@/lib/drizzle");
    const { sql } = await import("drizzle-orm");
    const exists = await db.execute(sql.raw(COLUMN_EXISTS_SQL));
    if (exists.length === 0) return { skipped: "column not found" };
    const merged = await db.transaction(async (tx) => tx.execute(sql.raw(MERGE_SQL)));
    return { merged: merged.count };
  },
};
