// scripts/tasks/setting-copy-list-per-page.ts
// 設定の実列 admin_list_per_page の値を jsonb(extended)へ写す。db:push で列を消す前に必ず 1 回走らせる。
// 手順: 旧版の書き込みを止める → pnpm task setting-copy-list-per-page → pnpm db:push → pnpm db:push:check
// 冪等: extended に既にあるキーは書き換えない。列が無ければ何もしない。写した後に一致を確かめる。

import type { OneShotTask } from "./types";

/** 列があるか */
export const COLUMN_EXISTS_SQL = `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'settings' AND column_name = 'admin_list_per_page'`;
/** extended に無い行だけ写す */
export const COPY_SQL = `UPDATE settings SET extended = COALESCE(extended, '{}'::jsonb) || jsonb_build_object('adminListPerPage', admin_list_per_page) WHERE NOT (COALESCE(extended, '{}'::jsonb) ? 'adminListPerPage')`;
/** 写した値と列が違う行(既に保存されたキーを尊重した行は mismatched として数える) */
export const VERIFY_SQL = `SELECT id FROM settings WHERE (extended->>'adminListPerPage') IS DISTINCT FROM admin_list_per_page::text`;

export const task: OneShotTask = {
  name: "setting-copy-list-per-page",
  run: async () => {
    const { db } = await import("@/lib/drizzle");
    const { sql } = await import("drizzle-orm");
    const exists = await db.execute(sql.raw(COLUMN_EXISTS_SQL));
    if (exists.length === 0) return { skipped: "column not found" };
    const copied = await db.execute(sql.raw(COPY_SQL));
    const mismatched = await db.execute(sql.raw(VERIFY_SQL));
    return { copied: copied.count, mismatched: mismatched.length };
  },
};
