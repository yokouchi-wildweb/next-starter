// scripts/runner/task/prepare.ts
// DB に届く道具の下準備(タスクのランナーと、DB に書く開発の道具 scripts/workflow/dev-admin が共有する。二重に作らない)。
// - loadEnvFile: 書く入口の共通の守り(scripts/runner/guard)を通して env ファイルを読む(既定は開発、本番は --env production と確認)
// - requireDatabase: DB が未設定なら即座に止める(接続を待たない)
// - asSystem: 監査の文脈を system にして走らせる(cron・CLI は routeFactory の文脈を持たない)
// server-only の下駄(scripts/runner/preload/serverOnly.mjs)は起動する側が付ける(pnpm task・pnpm workflow の .ts)。

import { guardEntry, type WriteTarget } from "../guard";

/** 共通の守りを通して env ファイルを読む(通らなければ理由を出して exit 1)。向き先を返す */
export function loadEnvFile(what: string): WriteTarget {
  return guardEntry({ write: true, db: true, what });
}

/** DB が未設定(DATABASE_URL が空)なら止める */
export async function requireDatabase(label: string): Promise<void> {
  const { isDatabaseConfigured } = await import("@/lib/drizzle");
  if (!isDatabaseConfigured()) throw new Error(`${label}: DATABASE_URL が未設定です(DB を設定してから)`);
}

/** 監査の文脈を system にして fn を走らせる(requestId = 実行の記録の行の id。省けば新しく作る) */
export async function asSystem<T>(fn: () => Promise<T>, requestId?: string): Promise<T> {
  const { runAsSystem } = await import("@/lib/audit/context");
  return runAsSystem(fn, requestId ? { requestId } : undefined);
}
