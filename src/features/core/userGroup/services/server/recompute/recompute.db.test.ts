// src/features/core/userGroup/services/server/recompute/recompute.db.test.ts
// 定期計算の実 DB テスト。1 つの取引の中で利用者・タグ・グループを書き、最後に戻す(開発 DB に行を残さない)。
// DATABASE_URL が無ければ skip。表・列が無ければ失敗する(先に pnpm db:push)。
// - 期限: 版が無い = すぐ、間隔の前は計算しない、グループの間隔(分)が効く
// - 続き: 1 束で止め、次の回に版の resume_after から続ける。書き終えるまで読む側は前の版
// - 切り替え: current_version・ready・computed_at・member_count。今の版と 1 つ前を残して古い版を消す
// - 失敗: 壊れた条件 = failed + 理由、今の版はそのまま。人数の上限 = failed + 理由。失敗の版は一番新しい 1 つだけ
// 実行: pnpm test --db src/features/core/userGroup/services/server/recompute/recompute.db.test.ts

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

class Rollback extends Error {}

describe("定期計算(実 DB、戻す)", { skip }, () => {
  after(async () => {
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("期限・続き・切り替え・片付け・失敗・上限", async () => {
    const { db } = await import("@/lib/drizzle");
    const { asc, eq } = await import("drizzle-orm");
    const { UserTable, UserToUserTagTable } = await import("@/features/core/user/entities/drizzle");
    const { UserTagTable } = await import("@/features/core/userTag/entities/drizzle");
    const T = await import("../../../entities/drizzle");
    const { criteria } = await import("../../../extensions/criteria");
    const { userGroupConfigDef } = await import("../../../config");
    const { createUserGroupEvaluator } = await import("../evaluation/evaluator");
    const { createUserGroupRecompute } = await import("./recompute");

    const far = () => new Date(Date.now() + 60_000);
    const sorted = (ids: string[]) => [...ids].sort();

    await assert.rejects(
      db.transaction(async (tx) => {
        const stamp = `ugr-test-${Date.now()}`;
        const [tag] = await tx.insert(UserTagTable).values({ name: stamp }).returning({ id: UserTagTable.id });
        const user = async (over: Partial<typeof UserTable.$inferInsert> = {}) => {
          const [row] = await tx
            .insert(UserTable)
            .values({ providerType: "local", providerUid: `${stamp}-${Math.random()}`, role: "user", status: "active", ...over })
            .returning({ id: UserTable.id });
          await tx.insert(UserToUserTagTable).values({ userId: row!.id, userTagId: tag!.id });
          return row!.id;
        };
        const tagged = [await user(), await user(), await user()];
        await user({ deletedAt: new Date() });
        const mine = { part: "hasTag", args: { tagIds: [tag!.id] } };

        const [g] = await tx.insert(T.UserGroupTable).values({ name: `${stamp}-c`, kind: "scheduled" }).returning();
        await tx.insert(T.UserGroupDefinitionTable).values({ group_id: g!.id, tree: mine as never });

        let clock = new Date();
        const recompute = (over: { memberLimit?: number } = {}) =>
          createUserGroupRecompute({
            db: tx,
            criteria,
            config: userGroupConfigDef.compose({ memberLimit: over.memberLimit ?? 100, recompute: { batchSize: 1, defaultIntervalMinutes: 60 } }),
            now: () => clock,
          });
        const e = createUserGroupEvaluator({ db: tx, criteria, config: userGroupConfigDef.compose({}), gateEnabled: () => true, now: () => clock });
        const versions = async () =>
          tx.select().from(T.UserGroupVersionTable).where(eq(T.UserGroupVersionTable.group_id, g!.id)).orderBy(asc(T.UserGroupVersionTable.version));
        const groupRow = async () => (await tx.select().from(T.UserGroupTable).where(eq(T.UserGroupTable.id, g!.id)))[0]!;

        // 1 回目: 1 束で止める(版はまだ今の版でない = 読む側は 409 のまま)
        const run1 = await recompute().run({ deadline: far(), maxChunks: 1 });
        assert.ok(run1.incomplete >= 1);
        let [v1] = await versions();
        assert.equal(v1!.status, "computing");
        assert.equal(v1!.member_count, 1);
        assert.ok(v1!.resume_after);
        assert.equal((await groupRow()).current_version, null);
        await assert.rejects(e.count({ groupId: g!.id }));

        // 2 回目: 続きから書き終えて切り替え
        await recompute().run({ deadline: far() });
        [v1] = await versions();
        assert.equal(v1!.status, "ready");
        assert.equal(v1!.member_count, 3);
        assert.ok(v1!.computedAt);
        assert.equal(v1!.resume_after, null);
        assert.equal((await groupRow()).current_version, v1!.version);
        assert.deepEqual(sorted((await e.listMemberIds(g!.id)).userIds), sorted(tagged));

        // 間隔の前は計算しない。間隔(60 分)を過ぎると次の版。書きかけの間は前の版を読む
        await recompute().run({ deadline: far() });
        assert.equal((await versions()).length, 1, "間隔の前は新しい版を作らない");
        clock = new Date(clock.getTime() + 61 * 60_000);
        await user(); // 次の版で 4 人になる
        await recompute().run({ deadline: far(), maxChunks: 1 });
        assert.equal((await versions()).length, 2);
        assert.equal((await e.count({ groupId: g!.id })).count, 3, "書きかけの間は前の版");
        await recompute().run({ deadline: far() });
        assert.equal((await e.count({ groupId: g!.id })).count, 4);

        // グループの間隔(分)が効く: 10 分なら 11 分後に次の版。3 つ目の版で一番古い版が消える(今と 1 つ前)
        await tx.update(T.UserGroupTable).set({ recompute_interval_minutes: 10 }).where(eq(T.UserGroupTable.id, g!.id));
        clock = new Date(clock.getTime() + 11 * 60_000);
        await recompute().run({ deadline: far() });
        const kept = await versions();
        assert.deepEqual(kept.map((v) => v.status), ["ready", "ready"]);
        assert.equal((await groupRow()).current_version, kept[1]!.version);

        // 人数の上限: failed + 理由、今の版はそのまま
        clock = new Date(clock.getTime() + 11 * 60_000);
        await recompute({ memberLimit: 2 }).run({ deadline: far() });
        let latest = (await versions()).at(-1)!;
        assert.equal(latest.status, "failed");
        assert.match(latest.error ?? "", /上限 2/);
        assert.equal((await groupRow()).current_version, kept[1]!.version);
        assert.equal((await e.count({ groupId: g!.id })).count, 4);

        // 壊れた条件: failed + 理由、失敗の版は一番新しい 1 つだけ
        await tx.update(T.UserGroupDefinitionTable).set({ tree: { part: "nope" } as never }).where(eq(T.UserGroupDefinitionTable.group_id, g!.id));
        clock = new Date(clock.getTime() + 11 * 60_000);
        await recompute().run({ deadline: far() });
        const afterFail = await versions();
        latest = afterFail.at(-1)!;
        assert.equal(latest.status, "failed");
        assert.match(latest.error ?? "", /条件が壊れています/);
        assert.equal(afterFail.filter((v) => v.status === "failed").length, 1);
        assert.equal((await groupRow()).current_version, kept[1]!.version);

        throw new Rollback();
      }),
      (error) => error instanceof Rollback,
    );
  });
});
