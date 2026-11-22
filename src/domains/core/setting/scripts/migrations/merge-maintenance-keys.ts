// src/domains/core/setting/scripts/migrations/merge-maintenance-keys.ts
// 設定の保存値の古い 3 キー(maintenanceEnabled・maintenanceStartAt・maintenanceEndAt)を 1 つのキー maintenance
// ({ enabled, startAt, endAt })へまとめ、古いキーを消す。新しい版を取り込んだら先に 1 回走らせる(手順: notice)。
// 冪等: 古いキーが無ければ何もしない。maintenance が既にある行(新しい版で保存済み)は古いキーを消すだけ。終わりに古いキーが残っていないか確かめる。

import type { OneShotTask } from "@/lib/task";

const OLD_KEYS = "ARRAY['maintenanceEnabled', 'maintenanceStartAt', 'maintenanceEndAt']";
const DROP_OLD = "- 'maintenanceEnabled' - 'maintenanceStartAt' - 'maintenanceEndAt'";

/** maintenance が無い行: 古い値をまとめて入れ、古いキーを消す(無い部分はキーの既定 = 無効・端なし) */
export const MERGE_SQL = `UPDATE settings SET extended = (COALESCE(extended, '{}'::jsonb) ${DROP_OLD}) || jsonb_build_object('maintenance', jsonb_build_object('enabled', COALESCE(extended->'maintenanceEnabled', 'false'::jsonb), 'startAt', COALESCE(extended->'maintenanceStartAt', 'null'::jsonb), 'endAt', COALESCE(extended->'maintenanceEndAt', 'null'::jsonb))) WHERE COALESCE(extended, '{}'::jsonb) ?| ${OLD_KEYS} AND NOT (COALESCE(extended, '{}'::jsonb) ? 'maintenance')`;
/** maintenance が既にある行: 新しい値を残し、古いキーだけ消す */
export const DROP_SQL = `UPDATE settings SET extended = extended ${DROP_OLD} WHERE COALESCE(extended, '{}'::jsonb) ?| ${OLD_KEYS} AND extended ? 'maintenance'`;
/** 古いキーが残っている行 */
export const VERIFY_SQL = `SELECT id FROM settings WHERE COALESCE(extended, '{}'::jsonb) ?| ${OLD_KEYS}`;

export const task: OneShotTask = {
  name: "setting:merge-maintenance-keys",
  notice: "20261119-195101-setting-code-values",
  run: async () => {
    const { db } = await import("@/lib/drizzle");
    const { sql } = await import("drizzle-orm");
    const merged = await db.execute(sql.raw(MERGE_SQL));
    const dropped = await db.execute(sql.raw(DROP_SQL));
    const remaining = await db.execute(sql.raw(VERIFY_SQL));
    return { merged: merged.count, dropped: dropped.count, remaining: remaining.length };
  },
};
