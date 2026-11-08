// src/features/core/user/services/server/wrappers/bulkChangeStatus.db.test.ts
// ステータスの一括変更(bulkChangeStatus)と changeStatus の tx の実 DB テスト。
// 開発 DB に一時のユーザー(provider_uid `test-bulk-status:<乱数>`)を作り、終了時に消す(遷移の履歴も)。監査の行は残る。
// DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test --db src/features/core/user/services/server/wrappers/bulkChangeStatus.db.test.ts

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

type Bulk = typeof import("./bulkChangeStatus");
type Change = typeof import("./changeStatus");
type UserRow = { id: string; status: string; sessionsInvalidatedAt?: Date | null };

const TAG = `test-bulk-status:${randomUUID().slice(0, 8)}`;
let bulk: Bulk["bulkChangeStatus"];
let change: Change["changeStatus"];
let asSystem: <T>(fn: () => Promise<T>) => Promise<T>;
let makeUser: (over?: Record<string, unknown>) => Promise<string>;
let userOf: (id: string) => Promise<UserRow>;
let historiesOf: (id: string) => Promise<Array<{ fromStatus: string | null; toStatus: string; trigger: string }>>;
let withTx: <T>(fn: (tx: never) => Promise<T>) => Promise<T>;
let cleanup: () => Promise<void>;

describe("bulkChangeStatus(実 DB)", { skip }, () => {
  before(async () => {
    bulk = (await import("./bulkChangeStatus")).bulkChangeStatus;
    change = (await import("./changeStatus")).changeStatus;
    const { runAsSystem } = await import("@/lib/audit");
    asSystem = (fn) => runAsSystem(fn);
    const { db } = await import("@/lib/drizzle");
    const { eq, like, inArray } = await import("drizzle-orm");
    const { UserTable, UserStatusHistoryTable } = await import("@/features/core/user/entities/drizzle");
    const { USER_PROVIDER_TYPES } = await import("@/features/core/user/constants");
    withTx = (fn) => db.transaction((tx) => fn(tx as never));
    makeUser = async (over = {}) => {
      const [row] = await db
        .insert(UserTable)
        .values({ providerType: USER_PROVIDER_TYPES[0], providerUid: `${TAG}:${randomUUID()}`, role: "user", status: "active", ...over })
        .returning({ id: UserTable.id });
      return row.id;
    };
    userOf = async (id) => (await db.select({ id: UserTable.id, status: UserTable.status, sessionsInvalidatedAt: UserTable.sessionsInvalidatedAt }).from(UserTable).where(eq(UserTable.id, id)))[0];
    historiesOf = async (id) =>
      db.select({ fromStatus: UserStatusHistoryTable.fromStatus, toStatus: UserStatusHistoryTable.toStatus, trigger: UserStatusHistoryTable.trigger }).from(UserStatusHistoryTable).where(eq(UserStatusHistoryTable.userId, id));
    cleanup = async () => {
      const ids = (await db.select({ id: UserTable.id }).from(UserTable).where(like(UserTable.providerUid, `${TAG}:%`))).map((r) => r.id);
      if (ids.length > 0) {
        await db.delete(UserStatusHistoryTable).where(inArray(UserStatusHistoryTable.userId, ids));
        await db.delete(UserTable).where(inArray(UserTable.id, ids));
      }
      // 接続を閉じる(開いたままだとテストのプロセスが終わらない)
      await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
    };
  });
  after(async () => {
    if (cleanup) await cleanup();
  });

  test("changeStatus に tx を渡すと、更新・遷移の履歴・監査は外の transaction と一緒に戻る", async () => {
    const id = await makeUser();
    await assert.rejects(() =>
      asSystem(() =>
        withTx(async (tx) => {
          await change({ userId: id, newStatus: "suspended", reason: "x" }, tx);
          throw new Error("rollback");
        }),
      ),
    /rollback/);
    assert.equal((await userOf(id)).status, "active");
    assert.deepEqual(await historiesOf(id), []);
    await asSystem(() => change({ userId: id, newStatus: "suspended", reason: "x" }));
    assert.equal((await userOf(id)).status, "suspended");
    assert.deepEqual(await historiesOf(id), [{ fromStatus: "active", toStatus: "suspended", trigger: "admin_change_status" }]);
  });

  test("一括: 変える人・飛ばす人(知らない・削除済み・既に同じ・--from 違い・管理者)、dry-run は書かない、打ち直すと全員飛ばす", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const already = await makeUser({ status: "suspended" });
    const inactive = await makeUser({ status: "inactive" });
    const admin = await makeUser({ role: "admin" });
    const deleted = await makeUser({ deletedAt: new Date() });
    const unknown = randomUUID();
    const ids = [a, b, already, inactive, admin, deleted, unknown];
    const params = { userIds: ids, newStatus: "suspended" as const, reason: "一括の試験", onlyFrom: "active" as const };

    const dry = await bulk({ ...params, dryRun: true });
    assert.deepEqual(dry.changed.map((r) => r.userId), [a, b]);
    assert.equal((await userOf(a)).status, "active", "dry-run は書かない");
    const why = new Map(dry.skipped.map((r) => [r.userId, r.why]));
    assert.match(why.get(already) ?? "", /既に suspended/);
    assert.match(why.get(inactive) ?? "", /--from active でない/);
    assert.match(why.get(admin) ?? "", /管理者のロール/);
    assert.match(why.get(deleted) ?? "", /削除済み/);
    assert.match(why.get(unknown) ?? "", /知らない id/);

    const done = await asSystem(() => bulk(params));
    assert.deepEqual([done.changed.length, done.failed.length], [2, 0]);
    for (const id of [a, b]) {
      assert.equal((await userOf(id)).status, "suspended");
      assert.deepEqual(await historiesOf(id), [{ fromStatus: "active", toStatus: "suspended", trigger: "admin_change_status" }]);
    }
    assert.equal((await userOf(admin)).status, "active", "管理者は変えない");

    const again = await asSystem(() => bulk(params));
    assert.deepEqual([again.changed.length, again.skipped.length], [0, ids.length], "打ち直しは全員飛ばす");
  });

  test("banned にした人は確定の後にセッションを失効する(sessions_invalidated_at)", async () => {
    const id = await makeUser();
    const done = await asSystem(() => bulk({ userIds: [id], newStatus: "banned", reason: "x" }));
    assert.deepEqual([done.changed.length, done.failed], [1, []]);
    const row = await userOf(id);
    assert.equal(row.status, "banned");
    assert.ok(row.sessionsInvalidatedAt instanceof Date, "セッションを失効した");
  });

  test("先に止める: withdrawn・pending・理由なし・空・重なり・--from と同じ先", async () => {
    const id = await makeUser();
    const base = { userIds: [id], reason: "x" };
    await assert.rejects(() => bulk({ ...base, newStatus: "withdrawn" }), /withdrawn には変えられません/);
    await assert.rejects(() => bulk({ ...base, newStatus: "pending" }), /pending には変えられません/);
    await assert.rejects(() => bulk({ ...base, newStatus: "active", reason: " " }), /理由/);
    await assert.rejects(() => bulk({ userIds: [], newStatus: "active", reason: "x" }), /id がありません/);
    await assert.rejects(() => bulk({ userIds: [id, id], newStatus: "active", reason: "x" }), /重なっています/);
    await assert.rejects(() => bulk({ ...base, newStatus: "active", onlyFrom: "active" }), /同じです/);
    assert.equal((await userOf(id)).status, "active");
  });
});
