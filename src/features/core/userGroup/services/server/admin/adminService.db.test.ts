// src/features/core/userGroup/services/server/admin/adminService.db.test.ts
// 管理の service の実 DB テスト。1 つの取引の中で利用者・タグ・グループを書き、最後に戻す(開発 DB に行を残さない)。
// DATABASE_URL が無ければ skip。表が無ければ失敗する(先に pnpm db:push)。監査は偽物で集める。
// - 作る・直す(動的 ⇄ 定期計算は可、静的との間は 409、heavy の注意、「静的グループの一員」は使える静的だけ)・しまう
// - 一覧(種類・状態で絞る、keyset、人数の印、例外の持ち主付きは出さない)と 1 件(元の定義・例外の人数)
// - 見込み(その場の定義・保存したグループ、試しは id と表示名だけ)
// - 例外: 持ち主付きの静的グループ 2 つ、包んだ木、足す人・外す人が人数に効く、持ち主を消すと一緒に消える
// - 静的: 選んだ利用者・別のグループ・タグから作る、incomplete から続き、足す・外す、人数の上限 409
// - 一員の一覧(静的、keyset、id と表示名、消した利用者は出さない)と例外の人の一覧(足す人・外す人、例外が無ければ空)、種類違いは 409
// - 監査の名前(user_group.*)、管理者でなければ 403
// 実行: pnpm test --db src/features/core/userGroup/services/server/admin/adminService.db.test.ts

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

class Rollback extends Error {}

describe("ユーザーグループの管理の service(実 DB、戻す)", { skip }, () => {
  after(async () => {
    const { db } = await import("@/lib/drizzle");
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("作る・直す・一覧・見込み・例外・静的・監査", async () => {
    const { db } = await import("@/lib/drizzle");
    const { eq } = await import("drizzle-orm");
    const { DomainError } = await import("@/lib/errors");
    const { UserTable, UserToUserTagTable } = await import("@/features/core/user/entities/drizzle");
    const { UserTagTable } = await import("@/features/core/userTag/entities/drizzle");
    const T = await import("../../../entities/drizzle");
    const { criteria } = await import("../../../extensions/criteria");
    const { userGroupConfigDef } = await import("../../../config");
    const { createUserGroupEvaluator } = await import("../evaluation/evaluator");
    const { createStaticMemberWriter } = await import("../writes/staticMembers");
    const { createUserGroupAdminService } = await import("./adminService");

    const code = (error: unknown, status: number) => error instanceof DomainError && error.status === status;
    const sorted = (ids: string[]) => [...ids].sort();
    // updateStaticMembers は mode remove だけ { memberCount } を返す(add / replace は group と members)
    type StaticResult = import("./dto").AdminStaticGroupResult;
    const written = (result: StaticResult | import("./dto").AdminStaticMembersRemoved) => result as StaticResult;

    await assert.rejects(
      db.transaction(async (tx) => {
        const stamp = `uga-test-${Date.now()}`;
        const [tag] = await tx.insert(UserTagTable).values({ name: stamp }).returning({ id: UserTagTable.id });
        const user = async (over: Partial<typeof UserTable.$inferInsert> = {}, tagged = true) => {
          const [row] = await tx
            .insert(UserTable)
            .values({ providerType: "local", providerUid: `${stamp}-${Math.random()}`, role: "user", status: "active", name: `${stamp}-name`, ...over })
            .returning({ id: UserTable.id });
          if (tagged) await tx.insert(UserToUserTagTable).values({ userId: row!.id, userTagId: tag!.id });
          return row!.id;
        };
        const [a, b, c] = [await user(), await user(), await user()];
        const outsider = await user({}, false);
        const admin = await user({ role: "admin" }, false);
        const mine = { part: "hasTag", args: { tagIds: [tag!.id] } };

        const audits: { action: string; targetId?: string | null; metadata?: Record<string, unknown> }[] = [];
        const service = (over: { memberLimit?: number; actorId?: string } = {}) => {
          const config = userGroupConfigDef.compose({ memberLimit: over.memberLimit ?? 100, write: { batchSize: 2 } });
          const evaluator = createUserGroupEvaluator({ db: tx, criteria, config, gateEnabled: () => true, now: () => new Date() });
          return createUserGroupAdminService({
            db: tx,
            criteria,
            config,
            evaluator,
            listEvaluator: evaluator,
            writer: createStaticMemberWriter({ db: tx, config, gateEnabled: () => true }),
            context: () => ({ actorId: over.actorId ?? admin, actorType: "admin", ip: null, userAgent: null, sessionId: null, requestId: "r" }) as never,
            roleCategoryOf: async (id) => (id === admin ? "admin" : "user"),
            recordAudit: async (input) => {
              audits.push(input as never);
            },
            now: () => new Date(),
          });
        };
        const s = service();

        // 管理者でなければ 403
        await assert.rejects(service({ actorId: a }).listGroups(), (error) => code(error, 403));

        // 作る: 動的(heavy でない)・定期計算・静的。静的に定義は 400、動的に定義なしは 400
        const dynamic = await s.createGroup({ name: `${stamp}-d`, kind: "dynamic", definition: mine });
        assert.equal(dynamic.kindLabel.length > 0, true);
        assert.deepEqual(dynamic.definition, mine);
        assert.deepEqual(dynamic.notices, []);
        await assert.rejects(s.createGroup({ name: "x", kind: "static", definition: mine }), (error) => code(error, 400));
        await assert.rejects(s.createGroup({ name: "x", kind: "dynamic" }), (error) => code(error, 400));
        const scheduled = await s.createGroup({ name: `${stamp}-c`, kind: "scheduled", definition: mine, recomputeIntervalMinutes: 120 });
        assert.equal(scheduled.recompute?.intervalMinutes, 120);
        assert.equal(scheduled.count.state, "none");
        assert.ok(scheduled.notices.length >= 2, "定期計算の反映の時期・版が無い");

        // 静的: 選んだ利用者から(束 2 で 1 回の予算に収まる)
        const fixed = await s.createStaticGroup({ name: `${stamp}-s`, from: { type: "users", userIds: [a, b] } });
        assert.equal(fixed.members.status, "replaced");
        assert.equal(fixed.group.count.value, 2);
        // 「静的グループの一員」は使える静的グループだけを指せる
        await assert.rejects(s.createGroup({ name: "x", kind: "dynamic", definition: { part: "inStaticGroup", args: { groupId: dynamic.id } } }), (error) => code(error, 400));
        const viaStatic = await s.createGroup({ name: `${stamp}-v`, kind: "dynamic", definition: { part: "inStaticGroup", args: { groupId: fixed.group.id } } });
        assert.equal(viaStatic.count.value, 2);

        // 直す: 動的 → 定期計算は可、静的との間は 409、名前
        const toScheduled = await s.updateGroup(viaStatic.id, { kind: "scheduled", name: `${stamp}-v2` });
        assert.equal(toScheduled.kind, "scheduled");
        assert.equal(toScheduled.name, `${stamp}-v2`);
        const back = await s.updateGroup(viaStatic.id, { kind: "dynamic" });
        assert.equal(back.kind, "dynamic");
        assert.equal(back.recompute, null);
        await assert.rejects(s.updateGroup(viaStatic.id, { kind: "static" }), (error) => code(error, 409));
        await assert.rejects(s.updateGroup(fixed.group.id, { kind: "dynamic", definition: mine }), (error) => code(error, 409));

        // heavy の注意(重い部品を足した部品の一覧で作る)
        const heavyCriteria = { ...criteria, heavyTag: { ...criteria.hasTag!, key: "heavyTag", weight: "heavy" as const } };
        const heavyService = createUserGroupAdminService({
          db: tx,
          criteria: heavyCriteria,
          config: userGroupConfigDef.compose({}),
          evaluator: createUserGroupEvaluator({ db: tx, criteria: heavyCriteria, config: userGroupConfigDef.compose({}), gateEnabled: () => true, now: () => new Date() }),
          listEvaluator: createUserGroupEvaluator({ db: tx, criteria: heavyCriteria, config: userGroupConfigDef.compose({}), gateEnabled: () => true, now: () => new Date() }),
          writer: createStaticMemberWriter({ db: tx, config: userGroupConfigDef.compose({}), gateEnabled: () => true }),
          context: () => ({ actorId: admin, actorType: "admin" }) as never,
          roleCategoryOf: async () => "admin",
          recordAudit: async () => {},
          now: () => new Date(),
        });
        const heavy = await heavyService.createGroup({ name: `${stamp}-h`, kind: "dynamic", definition: { part: "heavyTag", args: { tagIds: [tag!.id] } } });
        assert.equal(heavy.heavy, true);
        assert.equal(heavy.notices.length, 1);

        // 見込み: その場の定義と保存したグループ。試しは id と表示名だけ
        const inline = await s.estimate({ definition: mine });
        assert.equal(inline.count, 3);
        assert.deepEqual(Object.keys(inline.sample[0]!).sort(), ["id", "name"]);
        assert.equal(inline.sample[0]!.name, `${stamp}-name`);
        const saved = await s.estimate({ groupId: fixed.group.id });
        assert.deepEqual(sorted(saved.sample.map((u) => u.id)), sorted([a, b]));
        await assert.rejects(s.estimate({}), (error) => code(error, 400));

        // 例外: 足す人 outsider・外す人 a → 人数 3 - 1 + 1 = 3、木は包まれ、1 件は元の定義を返す
        const withExceptions = await s.updateExceptions(dynamic.id, { include: { add: [outsider] }, exclude: { add: [a] } });
        assert.deepEqual(withExceptions.exceptions, { includeCount: 1, excludeCount: 1 });
        assert.deepEqual(withExceptions.definition, mine);
        const counted = await s.estimate({ groupId: dynamic.id });
        assert.deepEqual(sorted(counted.sample.map((u) => u.id)), sorted([b, c, outsider]));
        const owners = await tx.select().from(T.UserGroupTable).where(eq(T.UserGroupTable.owner_group_id, dynamic.id));
        assert.equal(owners.length, 2);
        // 外す人に入れると足す人から外れる(逆も)
        const moved = await s.updateExceptions(dynamic.id, { exclude: { add: [outsider] } });
        assert.deepEqual(moved.exceptions, { includeCount: 0, excludeCount: 2 });
        // 定義を直しても包みは保つ
        const edited = await s.updateGroup(dynamic.id, { definition: { op: "or", children: [mine, { part: "inStaticGroup", args: { groupId: fixed.group.id } }] } });
        assert.deepEqual(edited.exceptions, { includeCount: 0, excludeCount: 2 });
        assert.deepEqual(sorted((await s.estimate({ groupId: dynamic.id })).sample.map((u) => u.id)), sorted([b, c]), "a と outsider は外す人");
        // 静的に例外は 409
        await assert.rejects(s.updateExceptions(fixed.group.id, { include: { add: [c] } }), (error) => code(error, 409));
        // 例外の人の一覧: 足す人は空、外す人は a と outsider(id の順、1 頁 1 人で続く)、id と表示名だけ
        assert.deepEqual(await s.listExceptionMembers(dynamic.id, { side: "include" }), { items: [], nextCursor: null });
        const excludeFirst = await s.listExceptionMembers(dynamic.id, { side: "exclude", limit: "1" });
        assert.equal(excludeFirst.items.length, 1);
        assert.deepEqual(Object.keys(excludeFirst.items[0]!).sort(), ["id", "name"]);
        assert.ok(excludeFirst.nextCursor);
        const excludeRest = await s.listExceptionMembers(dynamic.id, { side: "exclude", limit: "1", cursor: excludeFirst.nextCursor! });
        assert.equal(excludeRest.nextCursor, null);
        assert.deepEqual([...excludeFirst.items, ...excludeRest.items].map((u) => u.id), sorted([a, outsider]));
        // 例外がまだ無いグループは空、静的は 409、side が無ければ 400、cursor が壊れていれば 400
        assert.deepEqual(await s.listExceptionMembers(scheduled.id, { side: "exclude" }), { items: [], nextCursor: null });
        await assert.rejects(s.listExceptionMembers(fixed.group.id, { side: "include" }), (error) => code(error, 409));
        await assert.rejects(s.listExceptionMembers(dynamic.id, {}), (error) => code(error, 400));
        await assert.rejects(s.listExceptionMembers(dynamic.id, { side: "include", cursor: "xx" }), (error) => code(error, 400));
        await assert.rejects(s.listExceptionMembers(owners[0]!.id, { side: "include" }), (error) => code(error, 404));

        // 一覧: 例外の持ち主付きは出ない、種類で絞る、keyset
        const statics = await s.listGroups({ kind: "static", limit: 50 });
        assert.equal(statics.items.some((g) => owners.some((o) => o.id === g.id)), false);
        assert.ok(statics.items.some((g) => g.id === fixed.group.id));
        const first = await s.listGroups({ limit: 1 });
        assert.equal(first.items.length, 1);
        assert.ok(first.nextCursor);
        const second = await s.listGroups({ limit: 1, cursor: first.nextCursor! });
        assert.notEqual(second.items[0]?.id, first.items[0]?.id);
        const dynamicRow = (await s.listGroups({ kind: "dynamic", limit: 50 })).items.find((g) => g.id === dynamic.id);
        assert.deepEqual(dynamicRow?.count, { value: 2, state: "estimated" });
        await assert.rejects(s.getGroup(owners[0]!.id), (error) => code(error, 404));

        // 静的: 別のグループ・タグから(束 2・incomplete からの続きは maxChunks の代わりに予算 1ms で確かめる)
        const fromGroup = await s.createStaticGroup({ name: `${stamp}-g`, from: { type: "group", groupId: dynamic.id } });
        assert.equal(fromGroup.group.count.value, 2, "動的グループの今の一員 b・c");
        const fromTag = await s.createStaticGroup({ name: `${stamp}-t`, from: { type: "tag", tagId: tag!.id } });
        assert.equal(fromTag.group.count.value, 3);
        const slow = createUserGroupAdminService({
          db: tx,
          criteria,
          config: userGroupConfigDef.compose({ memberLimit: 100, write: { batchSize: 1 }, admin: { freezeBudgetMs: 1 } }),
          evaluator: createUserGroupEvaluator({ db: tx, criteria, config: userGroupConfigDef.compose({}), gateEnabled: () => true, now: () => new Date() }),
          listEvaluator: createUserGroupEvaluator({ db: tx, criteria, config: userGroupConfigDef.compose({}), gateEnabled: () => true, now: () => new Date() }),
          writer: createStaticMemberWriter({ db: tx, config: userGroupConfigDef.compose({ write: { batchSize: 1 } }), gateEnabled: () => true }),
          context: () => ({ actorId: admin, actorType: "admin" }) as never,
          roleCategoryOf: async () => "admin",
          recordAudit: async () => {},
          now: () => new Date(),
        });
        const pending = await slow.createStaticGroup({ name: `${stamp}-p`, from: { type: "tag", tagId: tag!.id } });
        assert.equal(pending.members.status, "incomplete");
        assert.equal(pending.group.count.value, 0, "書き終えるまで一員は空のまま");
        let resumed: { status: string } = pending.members;
        for (let i = 0; i < 10 && resumed.status === "incomplete"; i += 1) {
          resumed = written(await slow.updateStaticMembers(pending.group.id, { mode: "replace", from: { type: "tag", tagId: tag!.id } })).members;
        }
        assert.equal(resumed.status, "replaced");

        // 足す・人数の上限
        const added = written(await s.updateStaticMembers(fixed.group.id, { mode: "add", userIds: [c] }));
        assert.equal(added.members.status, "added");
        assert.equal(added.group.count.value, 3);
        await assert.rejects(service({ memberLimit: 3 }).updateStaticMembers(fixed.group.id, { mode: "add", userIds: [outsider] }), (error) => code(error, 409));
        await assert.rejects(service({ memberLimit: 2 }).createStaticGroup({ name: "x", from: { type: "users", userIds: [a, b, c] } }), (error) => code(error, 409));

        // 一員の一覧: a・b・c を 2 人ずつ(id の順)、id と表示名だけ。動的は 409、limit の外は 400
        const page1 = await s.listStaticMembers(fixed.group.id, { limit: "2" });
        assert.equal(page1.items.length, 2);
        assert.equal(page1.items[0]!.name, `${stamp}-name`);
        assert.ok(page1.nextCursor);
        const page2 = await s.listStaticMembers(fixed.group.id, { limit: "2", cursor: page1.nextCursor! });
        assert.equal(page2.nextCursor, null);
        assert.deepEqual([...page1.items, ...page2.items].map((u) => u.id), sorted([a, b, c]));
        await assert.rejects(s.listStaticMembers(dynamic.id), (error) => code(error, 409));
        await assert.rejects(s.listStaticMembers(fixed.group.id, { limit: "101" }), (error) => code(error, 400));
        await assert.rejects(service({ actorId: a }).listStaticMembers(fixed.group.id), (error) => code(error, 403));

        // 外す: 一員でない outsider は何もしない、返すのは人数だけ。動的は 409
        const removedResult = await s.updateStaticMembers(fixed.group.id, { mode: "remove", userIds: [c, outsider] });
        assert.deepEqual(removedResult, { memberCount: 2 });
        const removedAudit = audits.filter((row) => row.action === "user_group.members.removed");
        assert.equal(removedAudit.length, 1);
        assert.deepEqual({ removed: removedAudit[0]!.metadata?.removed, memberCount: removedAudit[0]!.metadata?.memberCount }, { removed: 1, memberCount: 2 });
        assert.deepEqual(await s.updateStaticMembers(fixed.group.id, { mode: "remove", userIds: [c] }), { memberCount: 2 });
        assert.equal(audits.filter((row) => row.action === "user_group.members.removed").length, 1, "外した人がいなければ監査しない");
        await assert.rejects(s.updateStaticMembers(dynamic.id, { mode: "remove", userIds: [a] }), (error) => code(error, 409));
        // 消した利用者は一覧に出ない
        await tx.update(UserTable).set({ deletedAt: new Date() }).where(eq(UserTable.id, b));
        assert.deepEqual((await s.listStaticMembers(fixed.group.id)).items.map((u) => u.id), [a]);
        await tx.update(UserTable).set({ deletedAt: null }).where(eq(UserTable.id, b));

        // しまう
        const archived = await s.archiveGroup(viaStatic.id);
        assert.equal(archived.status, "archived");
        await assert.rejects(s.updateGroup(viaStatic.id, { name: "y" }), (error) => code(error, 409));
        assert.ok((await s.listGroups({ status: "archived", limit: 50 })).items.some((g) => g.id === viaStatic.id));

        // 条件の部品の一覧: 表示名・欄・選択肢(タグ・静的グループ。例外の持ち主付きは出ない)
        const catalog = await s.criteriaCatalog();
        assert.ok(catalog.criteria.every((item) => item.label.length > 0));
        assert.ok(catalog.options.tags.some((option) => option.value === tag!.id && option.label === stamp));
        assert.ok(catalog.options.staticGroups.some((option) => option.value === fixed.group.id));
        assert.equal(catalog.options.staticGroups.some((option) => owners.some((o) => o.id === option.value)), false);
        const tagField = catalog.criteria.find((item) => item.key === "hasTag")!.fields.find((field) => field.name === "tagIds") as { options?: unknown[] };
        assert.ok((tagField.options ?? []).length > 0);

        // 監査の名前(利用者 id は入れない)
        const actions = new Set(audits.map((row) => row.action));
        for (const action of [
          "user_group.group.created",
          "user_group.group.updated",
          "user_group.group.archived",
          "user_group.exceptions.updated",
          "user_group.members.replaced",
          "user_group.members.added",
          "user_group.members.removed",
        ]) {
          assert.ok(actions.has(action), action);
        }
        assert.equal(JSON.stringify(audits).includes(outsider), false);

        // 持ち主を消すと例外のグループも消える(cascade)
        await tx.delete(T.UserGroupTable).where(eq(T.UserGroupTable.id, dynamic.id));
        assert.equal((await tx.select().from(T.UserGroupTable).where(eq(T.UserGroupTable.owner_group_id, dynamic.id))).length, 0);

        throw new Rollback();
      }),
      (error) => error instanceof Rollback,
    );
  });
});
