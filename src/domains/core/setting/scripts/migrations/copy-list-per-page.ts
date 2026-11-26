// src/domains/core/setting/scripts/migrations/copy-list-per-page.ts
// 設定の実列 admin_list_per_page の値を jsonb(extended)へ写す。db:push で列を消す前に必ず 1 回走らせる。
// 手順: 旧版の書き込みを止める → pnpm task setting:copy-list-per-page → pnpm db:push → pnpm db:push:check
// 冪等: extended に既にあるキーは書き換えない。列が無ければ何もしない。写した後に確かめる: キーが無い行(missing)が残れば打ち直せる失敗
// (TaskRerunnableError: 記録 failed・鍵を取らない、src/lib/task/README.md)、キーがあって列と違う行(kept = 保存済みの値を尊重した行)は数だけ出す。

import { TaskRerunnableError, type OneShotTask } from "@/lib/task";

/** 列があるか */
export const COLUMN_EXISTS_SQL = `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'settings' AND column_name = 'admin_list_per_page'`;
/** extended に無い行だけ写す */
export const COPY_SQL = `UPDATE settings SET extended = COALESCE(extended, '{}'::jsonb) || jsonb_build_object('adminListPerPage', admin_list_per_page) WHERE NOT (COALESCE(extended, '{}'::jsonb) ? 'adminListPerPage')`;
/** 写した後もキーが無い行(写せなかった行) */
export const MISSING_SQL = `SELECT id FROM settings WHERE NOT (COALESCE(extended, '{}'::jsonb) ? 'adminListPerPage')`;
/** キーがあって列と違う行(既に保存されたキーを尊重した行) */
export const KEPT_SQL = `SELECT id FROM settings WHERE COALESCE(extended, '{}'::jsonb) ? 'adminListPerPage' AND (extended->>'adminListPerPage') IS DISTINCT FROM admin_list_per_page::text`;

/** 写した後の判定: キーの無い行が残れば打ち直せる失敗で止める(成功で終わると鍵を取り、二度と走らない)。尊重した行は失敗にしない */
export function verdictOf(counts: { copied: number; missing: number; kept: number }): { copied: number; missing: number; kept: number } {
  if (counts.missing > 0) throw new TaskRerunnableError(`adminListPerPage を写せなかった行が ${counts.missing} 行あります(直して打ち直す)`, counts);
  return counts;
}

export const task: OneShotTask = {
  name: "setting:copy-list-per-page",
  notice: "20261031-141531-setting-fields-core-ui",
  run: async () => {
    const { db } = await import("@/lib/drizzle");
    const { sql } = await import("drizzle-orm");
    const exists = await db.execute(sql.raw(COLUMN_EXISTS_SQL));
    if (exists.length === 0) return { skipped: "column not found" };
    const copied = await db.execute(sql.raw(COPY_SQL));
    const missing = await db.execute(sql.raw(MISSING_SQL));
    const kept = await db.execute(sql.raw(KEPT_SQL));
    return verdictOf({ copied: copied.count, missing: missing.length, kept: kept.length });
  },
};
