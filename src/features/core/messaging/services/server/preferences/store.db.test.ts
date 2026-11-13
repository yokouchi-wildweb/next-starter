// src/features/core/messaging/services/server/preferences/store.db.test.ts
// 好みの表の一意(user_id, category, channel, kind、NULL を同じと見る)と書き込みの衝突の先(4 列)の実 DB テスト。
// 1 つの transaction の中で書いて最後に戻す(開発 DB に行を残さない)。利用者が 1 人もいなければ skip。
// DATABASE_URL が無ければ全件 skip。kind の列・一意が無ければ失敗する(先に pnpm db:push。指令 36 の push)。
// 実行: pnpm test --db src/features/core/messaging/services/server/preferences/store.db.test.ts

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

class Rollback extends Error {}

describe("message_preferences の一意と衝突の先(実 DB、戻す)", { skip }, () => {
  after(async () => {
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("kind null の同じ行は 1 つ、kind のある行は別の行(4 列の衝突の先で何もしない)", async (t) => {
    const { db } = await import("@/lib/drizzle");
    const { and, eq } = await import("drizzle-orm");
    const { UserTable } = await import("@/features/core/user/entities/drizzle");
    const { MessagePreferenceTable: P } = await import("../../../entities/preference");
    const { MESSAGE_PREFERENCE_CONFLICT_TARGET } = await import("./store");

    const [user] = await db.select({ id: UserTable.id }).from(UserTable).limit(1);
    if (!user) {
      t.skip("利用者がいない");
      return;
    }
    const category = `__test_${Date.now()}`;
    let counted: number | null = null;
    await assert.rejects(
      db.transaction(async (tx) => {
        const insert = (kind: string | null, cat = category) =>
          tx
            .insert(P)
            .values({ user_id: user.id, category: cat, channel: "*", kind, source: "test" })
            .onConflictDoNothing({ target: MESSAGE_PREFERENCE_CONFLICT_TARGET });
        await insert(null);
        await insert(null);
        await insert("marketing");
        await insert("marketing");
        const found = await tx.select({ id: P.id }).from(P).where(and(eq(P.user_id, user.id), eq(P.category, category)));
        counted = found.length;
        throw new Rollback();
      }),
      Rollback,
    );
    assert.equal(counted, 2);
  });
});
