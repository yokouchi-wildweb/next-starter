// src/domains/core/userGroup/services/server/evaluation/evaluator.db.test.ts
// 評価の口の実 DB テスト。1 つの取引の中で利用者・タグ・グループを書き、最後に戻す(開発 DB に行を残さない)。
// DATABASE_URL が無ければ skip。表が無ければ失敗する(先に pnpm db:push)。
// - 動的(条件の木を SQL に)・静的(一員)・定期計算(今の版の一員)の count / isMember / listMemberIds(keyset)、evaluate の試しの一覧
// - 6 つの部品が実 DB で引ける(ロール・状態・登録の時期・最後のログイン・タグ・静的グループの一員)、削除した利用者は母集団の外
// - 誤り: しまった 409・版の無い定期計算 409・heavy の動的の isMember 409・門が閉 404・時間の上限 503
// - 送信の固定: sendTarget(人数・上限・定期計算の版)と memberWhere(固定した版・述語・上限 409・門 404)
// 実行: pnpm test --db src/domains/core/userGroup/services/server/evaluation/evaluator.db.test.ts

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

class Rollback extends Error {}

describe("ユーザーグループの評価の口(実 DB、戻す)", { skip }, () => {
  after(async () => {
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("動的・静的・定期計算の数え・確かめ・列挙・その場の評価と、誤り", async () => {
    const { db } = await import("@/lib/drizzle");
    const { sql } = await import("drizzle-orm");
    const { z } = await import("zod");
    const { DomainError } = await import("@/lib/errors");
    const { UserTable, UserToUserTagTable } = await import("@/domains/core/user/entities/drizzle");
    const { UserTagTable } = await import("@/domains/core/userTag/entities/drizzle");
    const T = await import("../../../entities/drizzle");
    const { criteria } = await import("../../../extensions/criteria");
    const { userGroupConfigDef } = await import("../../../config");
    const { createUserGroupEvaluator } = await import("./evaluator");

    const NOW = new Date();
    const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
    const code = (error: unknown, status: number) => error instanceof DomainError && error.status === status;

    await assert.rejects(
      db.transaction(async (tx) => {
        const stamp = `ug-test-${Date.now()}`;
        const [tag] = await tx.insert(UserTagTable).values({ name: stamp }).returning({ id: UserTagTable.id });
        const user = async (over: Partial<typeof UserTable.$inferInsert>) => {
          const [row] = await tx
            .insert(UserTable)
            .values({ providerType: "local", providerUid: `${stamp}-${Math.random()}`, role: "user", status: "active", ...over })
            .returning({ id: UserTable.id });
          await tx.insert(UserToUserTagTable).values({ userId: row!.id, userTagId: tag!.id });
          return row!.id;
        };
        const fresh = await user({ createdAt: daysAgo(1), lastAuthenticatedAt: daysAgo(1) });
        const old = await user({ createdAt: daysAgo(400), lastAuthenticatedAt: daysAgo(200) });
        const never = await user({ createdAt: daysAgo(10), status: "inactive" });
        const admin = await user({ role: "admin", createdAt: daysAgo(5), lastAuthenticatedAt: NOW });
        await user({ deletedAt: NOW });
        const mine = { part: "hasTag", args: { tagIds: [tag!.id] } };

        const evaluator = (over: { gate?: boolean; criteria?: typeof criteria; timeoutMs?: number } = {}) =>
          createUserGroupEvaluator({
            db: tx,
            criteria: over.criteria ?? criteria,
            config: userGroupConfigDef.compose({ memberLimit: 3, evaluation: { timeoutMs: over.timeoutMs ?? 10_000 } }),
            gateEnabled: () => over.gate ?? true,
            now: () => NOW,
          });
        const e = evaluator();
        const sorted = (ids: string[]) => [...ids].sort();

        // その場の評価: タグの 4 人(削除した人は外)、上限 3 を超える
        const all = await e.evaluate(mine, { sampleLimit: 2 });
        assert.equal(all.count, 4);
        assert.equal(all.overLimit, true);
        assert.equal(all.sampleUserIds.length, 2);
        assert.deepEqual(all.sampleUserIds, sorted([fresh, old, never, admin]).slice(0, 2));
        const and = (node: unknown) => ({ op: "and", children: [mine, node] });
        const count = async (node: unknown) => (await e.count({ definition: and(node) as never })).count;
        assert.equal(await count({ part: "role", args: { roles: ["admin"] } }), 1);
        assert.equal(await count({ part: "status", args: { statuses: ["active"] } }), 3);
        assert.equal(await count({ part: "signupPeriod", args: { withinDays: 30 } }), 3);
        assert.equal(await count({ part: "lastLoginPeriod", args: { notWithinDays: 90 } }), 2, "200 日前と一度も無い人");
        assert.equal(await count({ op: "not", child: { part: "role", args: { roles: ["admin"] } } }), 3);

        // 静的グループと「一員」の部品
        const [staticGroup] = await tx.insert(T.UserGroupTable).values({ name: `${stamp}-s`, kind: "static" }).returning();
        await tx.insert(T.UserGroupMemberTable).values([fresh, admin].map((user_id) => ({ group_id: staticGroup!.id, user_id })));
        assert.equal((await e.count({ groupId: staticGroup!.id })).count, 2);
        assert.equal(await e.isMember(staticGroup!.id, fresh), true);
        assert.equal(await e.isMember(staticGroup!.id, old), false);
        assert.equal(await count({ op: "not", child: { part: "inStaticGroup", args: { groupId: staticGroup!.id } } }), 2);

        // 動的グループ(保存した木)の列挙は keyset
        const [dynamic] = await tx.insert(T.UserGroupTable).values({ name: `${stamp}-d`, kind: "dynamic" }).returning();
        await tx.insert(T.UserGroupDefinitionTable).values({ group_id: dynamic!.id, tree: mine as never });
        const first = await e.listMemberIds(dynamic!.id, { limit: 3 });
        assert.deepEqual(first.userIds, sorted([fresh, old, never, admin]).slice(0, 3));
        const second = await e.listMemberIds(dynamic!.id, { limit: 3, cursor: first.nextCursor });
        assert.deepEqual(second, { userIds: sorted([fresh, old, never, admin]).slice(3), nextCursor: null });
        assert.equal(await e.isMember(dynamic!.id, never), true);

        // 定期計算: 版が無い 409 → 今の版の一員
        const [scheduled] = await tx.insert(T.UserGroupTable).values({ name: `${stamp}-c`, kind: "scheduled" }).returning();
        await assert.rejects(e.count({ groupId: scheduled!.id }), (error) => code(error, 409));
        const [version] = await tx.insert(T.UserGroupVersionTable).values({ group_id: scheduled!.id, version: 1, status: "ready" }).returning();
        await tx.insert(T.UserGroupVersionMemberTable).values({ version_id: version!.id, user_id: old });
        await tx.update(T.UserGroupTable).set({ current_version: 1 }).where(sql`${T.UserGroupTable.id} = ${scheduled!.id}`);
        assert.equal((await e.count({ groupId: scheduled!.id })).count, 1);
        assert.equal(await e.isMember(scheduled!.id, old), true);

        // 送信の固定(D58): 送り始めの確かめ(定期計算は今の版を返す)と、固定の時の述語(固定した版・1 文で users から引ける)
        const idsWhere = async (where: import("drizzle-orm").SQL) =>
          sorted((await tx.select({ id: UserTable.id }).from(UserTable).where(where)).map((row) => row.id));
        assert.deepEqual(await e.sendTarget(scheduled!.id), { count: 1, memberLimit: 3, overLimit: false, version: 1 });
        const [version2] = await tx.insert(T.UserGroupVersionTable).values({ group_id: scheduled!.id, version: 2, status: "ready" }).returning();
        await tx.insert(T.UserGroupVersionMemberTable).values({ version_id: version2!.id, user_id: fresh });
        await tx.update(T.UserGroupTable).set({ current_version: 2 }).where(sql`${T.UserGroupTable.id} = ${scheduled!.id}`);
        const pinned = await e.memberWhere(scheduled!.id, { version: 1 });
        assert.deepEqual(await idsWhere(pinned.where), [old], "送り始めに固定した版 1 の一員");
        assert.equal(pinned.count, 1);
        assert.equal(pinned.timeoutMs, 10_000);
        assert.deepEqual(await idsWhere((await e.memberWhere(scheduled!.id)).where), [fresh], "版を渡さなければ今の版");
        await assert.rejects(e.memberWhere(scheduled!.id, { version: 9 }), (error) => code(error, 409));
        assert.deepEqual(await idsWhere((await e.memberWhere(staticGroup!.id)).where), sorted([fresh, admin]));
        assert.deepEqual((await e.sendTarget(dynamic!.id)).overLimit, true);
        assert.equal((await e.sendTarget(dynamic!.id)).version, null);
        await assert.rejects(e.memberWhere(dynamic!.id), (error) => code(error, 409), "動的の 4 人は上限 3 を超える");
        await assert.rejects(evaluator({ gate: false }).memberWhere(staticGroup!.id), (error) => code(error, 404));
        await assert.rejects(evaluator({ gate: false }).sendTarget(staticGroup!.id), (error) => code(error, 404));

        // 誤り: しまった 409・heavy の動的の isMember 409・門が閉 404・その場の定義の誤り 400・時間の上限 503
        await tx.update(T.UserGroupTable).set({ status: "archived" }).where(sql`${T.UserGroupTable.id} = ${staticGroup!.id}`);
        await assert.rejects(e.count({ groupId: staticGroup!.id }), (error) => code(error, 409));
        const heavyCriteria = { ...criteria, heavyTag: { ...criteria.hasTag!, key: "heavyTag", weight: "heavy" as const } };
        await tx.update(T.UserGroupDefinitionTable).set({ has_heavy: true }).where(sql`${T.UserGroupDefinitionTable.group_id} = ${dynamic!.id}`);
        await assert.rejects(evaluator({ criteria: heavyCriteria }).isMember(dynamic!.id, fresh), (error) => code(error, 409));
        await assert.rejects(evaluator({ gate: false }).count({ groupId: dynamic!.id }), (error) => code(error, 404));
        await assert.rejects(e.evaluate({ part: "nope" }), (error) => code(error, 400));
        const slow = { ...criteria, slow: { key: "slow", label: "遅い", args: z.object({}).strict(), fields: [], weight: "cheap" as const, where: () => sql`pg_sleep(0.2) is not null` } };
        await assert.rejects(evaluator({ criteria: slow, timeoutMs: 50 }).evaluate({ op: "and", children: [mine, { part: "slow" }] }), (error) => code(error, 503));

        throw new Rollback();
      }),
      (error) => error instanceof Rollback,
    );
  });
});
