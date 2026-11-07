// src/features/core/userProfile/utils/createProfileBase.db.test.ts
// createProfileBase の audit と updateByUserId の実 DB テスト（audit_logs に行が入ること、空の配列が null になること）。
// 開発 DB に専用の表 test_profile_audit_items を作り、終了時に DROP する。audit_logs には target_type `testProfileAudit` の行を作り、終了時に消す。
// DATABASE_URL が無ければ全件 skip。先に audit_logs が push 済みであること。
// 実行: pnpm test:profile-base-db

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

const TARGET_TYPE = "testProfileAudit";
const TestTable = pgTable("test_profile_audit_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  city: text("city"),
  memo: text("memo"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

describe("createProfileBase の audit（実 DB）", { skip }, () => {
  let db: typeof import("@/lib/drizzle").db;
  let runAsSystem: typeof import("@/lib/audit/context").runAsSystem;
  let base: import("../types").ProfileBase;
  let before0 = 0;

  const countAll = async () => Number((await db.execute(sql`select count(*)::int as n from audit_logs`))[0].n);
  const rows = async (targetId: string) =>
    (await db.execute(sql`select action from audit_logs where target_type = ${TARGET_TYPE} and target_id = ${targetId}`)) as unknown as { action: string }[];

  before(async () => {
    ({ db } = await import("@/lib/drizzle"));
    ({ runAsSystem } = await import("@/lib/audit/context"));
    const { auditLogger } = await import("@/features/core/auditLog/services/server");
    const { createProfileBase } = await import("./createProfileBase");
    before0 = await countAll();
    await db.execute(sql`drop table if exists test_profile_audit_items`);
    await db.execute(sql`create table test_profile_audit_items (
      id uuid primary key default gen_random_uuid(), user_id uuid not null unique, city text, memo text, tags text[],
      created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
    base = createProfileBase(TestTable, {
      audit: { enabled: true, targetType: TARGET_TYPE, actionPrefix: "test_profile_audit", trackedFields: ["city"], recorder: auditLogger },
    });
  });

  after(async () => {
    await db.execute(sql`delete from audit_logs where target_type = ${TARGET_TYPE}`);
    await db.execute(sql`drop table if exists test_profile_audit_items`);
    const count = await countAll();
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
    assert.equal(count, before0, "audit_logs の件数が前後で同じ");
  });

  test("追跡項目の更新で 1 行入り、追跡外だけの更新では増えない", async () => {
    const userId = randomUUID();
    const created = (await runAsSystem(() => base.create({ userId, city: "a", memo: "m" }))) as { id: string };
    const start = (await rows(created.id)).length;
    const updated = await runAsSystem(() => base.updateByUserId(userId, { city: "b" }));
    assert.equal((updated as { city?: string }).city, "b");
    const afterTracked = await rows(created.id);
    assert.equal(afterTracked.length, start + 1);
    assert.ok(afterTracked.some((row) => row.action === "test_profile_audit.updated"));
    await runAsSystem(() => base.updateByUserId(userId, { memo: "n" }));
    assert.equal((await rows(created.id)).length, start + 1);
  });

  test("空の配列は null で保存され、不在の userId は null を返して書かない", async () => {
    const userId = randomUUID();
    await runAsSystem(() => base.create({ userId, tags: ["x"] }));
    const updated = await runAsSystem(() => base.updateByUserId(userId, { tags: [] }));
    assert.equal((updated as { tags?: unknown }).tags, null);
    assert.equal(await runAsSystem(() => base.updateByUserId(randomUUID(), { city: "z" })), null);
  });
});
