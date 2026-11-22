// src/domains/core/messaging/scripts/migrations/rename-template-vars.ts
// テンプレートと版の列 embedded を vars へ改名する(値はそのまま)。db:push の前に必ず 1 回走らせる。
// 手順: pnpm task messaging:rename-template-vars → pnpm db:push → pnpm db:push:check(差分 0)
// push を先にすると drizzle-kit が embedded を消して vars を足す(宣言が失われる)。
// 冪等: 表ごとに embedded があり vars が無い時だけ改名する。表が無い・済んだ表は飛ばす。

import { type OneShotTask, TaskNotStartedError } from "@/lib/task";

/** 改名する表(テンプレートと版) */
export const TABLES = ["message_templates", "message_template_versions"] as const;

/** 表の列のうち embedded / vars のある物 */
export const columnsSql = (table: string) =>
  `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${table}' AND column_name IN ('embedded', 'vars')`;

/** 改名の文 */
export const renameSql = (table: string) => `ALTER TABLE ${table} RENAME COLUMN embedded TO vars`;

/** 列の有無 → 改名するか(embedded があり vars が無い時だけ。両方ある表は手で確かめるので止める) */
export function planRename(columns: readonly string[]): "rename" | "skip" | "conflict" {
  const hasOld = columns.includes("embedded");
  const hasNew = columns.includes("vars");
  if (hasOld && hasNew) return "conflict";
  return hasOld ? "rename" : "skip";
}

export const task: OneShotTask = {
  name: "messaging:rename-template-vars",
  notice: "20261122-134000-messaging-records",
  run: async () => {
    const { db } = await import("@/lib/drizzle");
    const { sql } = await import("drizzle-orm");
    const plans = await Promise.all(
      TABLES.map(async (table) => {
        const rows = (await db.execute(sql.raw(columnsSql(table)))) as unknown as { column_name: string }[];
        return { table, plan: planRename(rows.map((row) => row.column_name)) };
      }),
    );
    const conflicts = plans.filter((item) => item.plan === "conflict").map((item) => item.table);
    if (conflicts.length > 0) {
      throw new TaskNotStartedError(`embedded と vars の両方がある表: ${conflicts.join(", ")}(値を確かめて片方を手で消してから打ち直す)`);
    }
    const renamed: string[] = [];
    await db.transaction(async (tx) => {
      for (const item of plans) {
        if (item.plan !== "rename") continue;
        await tx.execute(sql.raw(renameSql(item.table)));
        renamed.push(item.table);
      }
    });
    return { renamed, skipped: plans.filter((item) => item.plan === "skip").map((item) => item.table) };
  },
};
