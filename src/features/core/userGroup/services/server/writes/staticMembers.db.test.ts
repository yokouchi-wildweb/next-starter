// src/features/core/userGroup/services/server/writes/staticMembers.db.test.ts
// 静的グループへ書く口の実 DB テスト。1 つの取引の中で利用者・グループを書き、最後に戻す(開発 DB に行を残さない)。
// DATABASE_URL が無ければ skip。表・列が無ければ失敗する(先に pnpm db:push)。
// - 置き換えを途中で止めて読むと前の一員のまま(評価の口の count・listMemberIds)、続きの呼び出しで入れ替わる(残る一員の created_at は変わらない)
// - 無い・削除された利用者は飛ばして数える、keyset の供給でも同じ、restart で下書きを捨てる
// - 人数の上限: 置き換えは 409 で下書きを消して前の一員のまま、足すは書かずに 409
// - 種類の誤り(動的・定期計算)・しまった = 409、門が閉 = 404
// 実行: pnpm test --db src/features/core/userGroup/services/server/writes/staticMembers.db.test.ts

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

class Rollback extends Error {}

describe("静的グループへ書く口(実 DB、戻す)", { skip }, () => {
  after(async () => {
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("置き換え(途中は前の一員のまま)・足す・外す・上限・種類の誤り", async () => {
    const { db } = await import("@/lib/drizzle");
    const { and, eq } = await import("drizzle-orm");
    const { DomainError } = await import("@/lib/errors");
    const { UserTable } = await import("@/features/core/user/entities/drizzle");
    const T = await import("../../../entities/drizzle");
    const { criteria } = await import("../../../extensions/criteria");
    const { userGroupConfigDef } = await import("../../../config");
    const { createUserGroupEvaluator } = await import("../evaluation/evaluator");
    const { createStaticMemberWriter } = await import("./staticMembers");
    const { arraySupplier } = await import("./versionWriter");

    const code = (error: unknown, status: number) => error instanceof DomainError && error.status === status;
    const sorted = (ids: string[]) => [...ids].sort();

    await assert.rejects(
      db.transaction(async (tx) => {
        const stamp = `ugw-test-${Date.now()}`;
        const user = async (over: Partial<typeof UserTable.$inferInsert> = {}) => {
          const [row] = await tx
            .insert(UserTable)
            .values({ providerType: "local", providerUid: `${stamp}-${Math.random()}`, role: "user", status: "active", ...over })
            .returning({ id: UserTable.id });
          return row!.id;
        };
        const [u1, u2, u3, u4] = [await user(), await user(), await user(), await user()];
        const gone = await user({ deletedAt: new Date() });
        const group = async (kind: "static" | "dynamic" | "scheduled", name: string) =>
          (await tx.insert(T.UserGroupTable).values({ name: `${stamp}-${name}`, kind }).returning())[0]!;
        const g = await group("static", "s");

        const writer = (over: { memberLimit?: number; gate?: boolean } = {}) =>
          createStaticMemberWriter({
            db: tx,
            config: userGroupConfigDef.compose({ memberLimit: over.memberLimit ?? 100, write: { batchSize: 1 } }),
            gateEnabled: () => over.gate ?? true,
          });
        const w = writer();
        const e = createUserGroupEvaluator({
          db: tx,
          criteria,
          config: userGroupConfigDef.compose({}),
          gateEnabled: () => true,
          now: () => new Date(),
        });
        const members = async () => (await e.listMemberIds(g.id, { limit: 100 })).userIds;
        const createdAtOf = async (userId: string) =>
          (await tx.select().from(T.UserGroupMemberTable).where(and(eq(T.UserGroupMemberTable.group_id, g.id), eq(T.UserGroupMemberTable.user_id, userId))))[0]?.createdAt;
        const stages = async () =>
          tx.select().from(T.UserGroupVersionTable).where(eq(T.UserGroupVersionTable.group_id, g.id));

        // 足す: 無い・削除された利用者は飛ばす
        assert.deepEqual(await w.addMembers(g.id, [u1, u2, gone, "not-a-uuid"]), { added: 2, skipped: 2, memberCount: 2 });
        const u2Joined = await createdAtOf(u2);

        // 置き換えを 1 束で止める: 前の一員のまま見える
        const next = [u2, u3, u4, gone];
        const first = await w.replaceMembers(g.id, next, { maxChunks: 1 });
        assert.equal(first.status, "incomplete");
        assert.deepEqual(sorted(await members()), sorted([u1, u2]));
        assert.equal((await e.count({ groupId: g.id })).count, 2);
        assert.equal((await stages()).length, 1, "下書きの版が 1 つ");

        // 続きの呼び出しで入れ替わる(下書きは消える、残る一員の created_at はそのまま)
        const done = await w.replaceMembers(g.id, next);
        assert.deepEqual(done, { status: "replaced", memberCount: 3, added: 2, removed: 1, skipped: 1 });
        assert.deepEqual(sorted(await members()), sorted([u2, u3, u4]));
        assert.equal((await stages()).length, 0);
        assert.equal((await createdAtOf(u2))?.getTime(), u2Joined?.getTime());

        // keyset の供給でも同じ。restart で書きかけの下書きを捨てて最初から
        await w.replaceMembers(g.id, [u1, u2, u3, u4], { maxChunks: 1 });
        const viaSupplier = await w.replaceMembers(g.id, arraySupplier([u1]), { restart: true });
        assert.equal(viaSupplier.status, "replaced");
        assert.deepEqual(await members(), [u1]);

        // 人数の上限: 置き換えは 409 で下書きを消し前の一員のまま、足すは書かずに 409
        await assert.rejects(writer({ memberLimit: 2 }).replaceMembers(g.id, [u1, u2, u3]), (error) => code(error, 409));
        assert.deepEqual(await members(), [u1]);
        assert.equal((await stages()).length, 0);
        await assert.rejects(writer({ memberLimit: 2 }).addMembers(g.id, [u2, u3]), (error) => code(error, 409));
        assert.deepEqual(await members(), [u1]);

        // 外す
        await w.addMembers(g.id, [u2]);
        assert.deepEqual(await w.removeMembers(g.id, [u1, u3]), { removed: 1, memberCount: 1 });
        assert.deepEqual(await members(), [u2]);

        // 種類の誤り・しまった 409、門が閉 404、id の形 400
        const d = await group("dynamic", "d");
        const c = await group("scheduled", "c");
        await assert.rejects(w.replaceMembers(d.id, [u1]), (error) => code(error, 409));
        await assert.rejects(w.addMembers(c.id, [u1]), (error) => code(error, 409));
        await assert.rejects(writer({ gate: false }).removeMembers(g.id, [u1]), (error) => code(error, 404));
        await assert.rejects(w.addMembers("nope", [u1]), (error) => code(error, 400));
        await tx.update(T.UserGroupTable).set({ status: "archived" }).where(eq(T.UserGroupTable.id, g.id));
        await assert.rejects(w.addMembers(g.id, [u1]), (error) => code(error, 409));

        throw new Rollback();
      }),
      (error) => error instanceof Rollback,
    );
  });
});
