// src/features/core/messaging/services/server/sendMessage/store.db.test.ts
// 全員・ロール宛ての利用者の引き(listUserIds / countUserIds)が user の公開の述語(availableUserWhere)で絞る実 DB テスト。
// 読むだけ(行を書かない)。DATABASE_URL が無ければ全件 skip。
// - 数 = 述語で数えた数(ロールの絞りも同じ)、引いた id はどれも削除されていない・利用できる状態・デモでない
// 実行: pnpm test --db src/features/core/messaging/services/server/sendMessage/store.db.test.ts

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

describe("全員・ロール宛ての利用者の引き(実 DB、読むだけ)", { skip }, () => {
  after(async () => {
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("数と引いた id は利用できる利用者の述語のとおり(削除・利用できない状態・デモを外す)", async () => {
    const { db } = await import("@/lib/drizzle");
    const { and, count, eq, inArray } = await import("drizzle-orm");
    const { UserTable } = await import("@/features/core/user/entities/drizzle");
    const { USER_AVAILABLE_STATUSES } = await import("@/features/core/user/constants");
    const { availableUserWhere } = await import("@/features/core/user/services/server/availableUsers");
    const { drizzleMessageSendStore: store } = await import("./store");

    const [expected] = await db.select({ value: count() }).from(UserTable).where(availableUserWhere());
    assert.equal(await store.countUserIds({}), Number(expected?.value ?? 0));
    const [admins] = await db
      .select({ value: count() })
      .from(UserTable)
      .where(and(availableUserWhere(), eq(UserTable.role, "admin")));
    assert.equal(await store.countUserIds({ roles: ["admin"] }), Number(admins?.value ?? 0));

    const { userIds } = await store.listUserIds({}, null, 200);
    if (userIds.length === 0) return;
    const rows = await db
      .select({ status: UserTable.status, deletedAt: UserTable.deletedAt, isDemo: UserTable.isDemo })
      .from(UserTable)
      .where(inArray(UserTable.id, userIds));
    assert.equal(rows.length, userIds.length);
    for (const row of rows) {
      assert.equal(row.deletedAt, null);
      assert.ok((USER_AVAILABLE_STATUSES as readonly string[]).includes(row.status));
      assert.equal(row.isDemo, false);
    }
  });
});
