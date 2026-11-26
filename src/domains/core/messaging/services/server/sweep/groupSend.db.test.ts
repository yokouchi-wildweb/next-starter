// src/domains/core/messaging/services/server/sweep/groupSend.db.test.ts
// グループ宛ての送信の固定(D58)の実 DB テスト。本物の送る口・掃き出しの store・userGroup の評価の口(門は開に差し替え)で、
// 送信は「続きを送る」(continueDispatch = その送信だけ)で進める(開発 DB の他の送信には触れない)。
// 掃き出しの store は取引を受けないので戻せない: 書いた行(利用者・グループ・送信)は after で消す(送信を消すと配達・一覧も消える)。
// DATABASE_URL が無ければ skip。表が無ければ失敗する(先に pnpm db:push: message_dispatch_recipients)。
// - 最初の 1 回で一員を 1 文で一覧へ書く(配達なし)。利用できない利用者・送り始めより後の登録は入らない
// - 書いた後でグループが変わっても宛先は変わらない(一覧の段は束ごとに再開)
// - 送り始め: 人数の上限は 409 で送信を作らない。固定の時に門が閉・人数の上限なら送信を cancelled + cancelReason
// - 全員・ロールの送り始めの線: その時刻より後に登録した利用者を引かない
// 実行: pnpm test --db src/domains/core/messaging/services/server/sweep/groupSend.db.test.ts

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

describe("グループ宛ての送信の固定(実 DB、書いた行は消す)", { skip }, () => {
  const cleanup: (() => Promise<unknown>)[] = [];

  after(async () => {
    const { db } = await import("@/lib/drizzle");
    for (const step of cleanup.reverse()) await step();
    await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
  });

  test("一覧へ 1 文で書き、一覧だけから送る・門が閉と上限は止める・全員の線", async () => {
    const { db } = await import("@/lib/drizzle");
    const { eq, inArray } = await import("drizzle-orm");
    const { z } = await import("zod");
    const { defineMessage } = await import("@/lib/messaging");
    const { DomainError } = await import("@/lib/errors");
    const { UserTable } = await import("@/domains/core/user/entities/drizzle");
    const G = await import("@/domains/core/userGroup/entities/drizzle");
    const { userGroupCriteria } = await import("@/domains/core/userGroup/extensions/userGroupCriteria");
    const criteria = Object.fromEntries(userGroupCriteria.map((entry) => [entry.plug.key, entry.plug]));
    const { userGroupConfigDef } = await import("@/domains/core/userGroup/config");
    const { createUserGroupEvaluator } = await import("@/domains/core/userGroup/services/server/evaluation/evaluator");
    const { MessageDispatchTable } = await import("../../../entities/drizzle");
    const { MessageDeliveryTable } = await import("../../../entities/drizzle");
    const { MessageDispatchRecipientTable } = await import("../../../entities/drizzle");
    const { MESSAGE_EXPAND_DONE } = await import("../../../entities/schema");
    const { sendMessageDeps } = await import("../sendMessage");
    const { drizzleMessageSendStore } = await import("../sendMessage/store");
    const { createMessageSender } = await import("../sendMessage/sender");
    const { TEST_CATEGORIES, TEST_LAYOUTS, createTestChannel } = await import("../sendMessage/testHelpers");
    const { drizzleMessageSweepStore } = await import("./store");
    const { continueDispatch } = await import("./sweep");
    const { randomUUID } = await import("node:crypto");

    const code = (error: unknown, status: number) => error instanceof DomainError && error.status === status;
    const stamp = `msg-group-${Date.now()}`;
    const HOUR = 3_600_000;

    // 利用者: 一覧の最後に並ぶよう id の頭をそろえる(線の検査を keyset の位置で確かめる)
    const prefix = `ffffffff-ffff-4fff-bfff-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const idOf = (n: number) => `${prefix}${String(n).padStart(4, "0")}`;
    const user = async (n: number, over: Partial<typeof UserTable.$inferInsert> = {}) => {
      const [row] = await db
        .insert(UserTable)
        .values({ id: idOf(n), providerType: "local", providerUid: `${stamp}-${n}`, role: "user", status: "active", name: `${stamp}-${n}`, createdAt: new Date(Date.now() - HOUR), ...over })
        .returning({ id: UserTable.id });
      return row!.id;
    };
    const [a, b, c] = [await user(1), await user(2), await user(3)];
    const inactive = await user(4, { status: "inactive" });
    const later = await user(5, { createdAt: new Date(Date.now() + HOUR) });
    const userIds = [a, b, c, inactive, later];
    cleanup.push(() => db.delete(UserTable).where(inArray(UserTable.id, userIds)));

    const [group] = await db.insert(G.UserGroupTable).values({ name: `${stamp}-g`, kind: "static" }).returning();
    cleanup.push(() => db.delete(G.UserGroupTable).where(eq(G.UserGroupTable.id, group!.id)));
    await db.insert(G.UserGroupMemberTable).values([a, b, inactive, later].map((user_id) => ({ group_id: group!.id, user_id })));

    // 連絡の部品: 本物の store、テストの送信チャンネル(宛先 = 利用者 id)、門は開に差し替えた評価の口
    const notice = defineMessage({
      key: `test.groupSend`,
      label: "グループ宛てのテスト",
      category: "news",
      vars: z.object({ item: z.string() }),
      varNames: { item: { alias: "品名", description: "テストの品名" } },
      layout: "card", values: { title: "{{item}}" },
    });
    const channel = createTestChannel("test");
    channel.resolveAddresses = async (ids) => ids.map((userId) => ({ userId, address: userId }));
    let groupsOpen = true;
    let memberLimit = 100;
    const evaluator = () =>
      createUserGroupEvaluator({
        db,
        criteria,
        config: userGroupConfigDef.compose({ memberLimit }),
        gateEnabled: () => true,
        now: () => new Date(),
      });
    const deps = {
      ...sendMessageDeps,
      channels: { test: channel },
      categories: TEST_CATEGORIES,
      // テストのレイアウト(card)も並べる(本物の受け口に重ねる)
      layouts: { ...sendMessageDeps.layouts, ...TEST_LAYOUTS },
      registry: { [notice.key]: { key: notice.key, definition: async () => ({ message: notice }) } },
      adminOverrides: undefined,
      templates: undefined,
      eventTypes: undefined,
      config: { ...sendMessageDeps.config, expandChunkSize: 1 },
      groups: {
        enabled: () => groupsOpen,
        sendTarget: (groupId: string) => evaluator().sendTarget(groupId),
        memberWhere: (groupId: string, options: { version: number | null }) => evaluator().memberWhere(groupId, options),
      },
      sweepStore: drizzleMessageSweepStore,
      newToken: () => randomUUID(),
    };
    const sender = createMessageSender(deps);
    const send = async () => {
      const result = await sender.sendMessageToMany(notice, { target: { type: "group", groupId: group!.id }, vars: { item: "x" } });
      const id = result.dispatchId!;
      cleanup.unshift(() => db.delete(MessageDispatchTable).where(eq(MessageDispatchTable.id, id)));
      return id;
    };
    const dispatchOf = async (id: string) => (await db.select().from(MessageDispatchTable).where(eq(MessageDispatchTable.id, id)))[0]!;
    const listed = async (id: string) =>
      (await db.select({ id: MessageDispatchRecipientTable.user_id }).from(MessageDispatchRecipientTable).where(eq(MessageDispatchRecipientTable.dispatch_id, id)))
        .map((row) => row.id)
        .sort();
    const delivered = async (id: string) =>
      (await db.select({ id: MessageDeliveryTable.user_id }).from(MessageDeliveryTable).where(eq(MessageDeliveryTable.dispatch_id, id)))
        .map((row) => row.id!)
        .sort();

    // 1 回目で一覧へ書く(配達なし)。inactive は利用できない、later は送り始めより後の登録
    const first = await send();
    assert.equal((await dispatchOf(first)).expand_cursor, null);
    await continueDispatch(deps, first);
    assert.deepEqual(await listed(first), [a, b].sort());
    assert.deepEqual(await delivered(first), []);
    assert.equal((await dispatchOf(first)).expand_cursor, "l:");

    // 書いた後でグループが変わっても宛先は変わらない(束 1 人ずつ再開)
    await db.delete(G.UserGroupMemberTable).where(eq(G.UserGroupMemberTable.user_id, b));
    await db.insert(G.UserGroupMemberTable).values({ group_id: group!.id, user_id: c });
    await continueDispatch(deps, first);
    assert.equal((await dispatchOf(first)).expand_cursor, `l:${[a, b].sort()[0]}`);
    for (let i = 0; i < 4 && (await dispatchOf(first)).status === "processing"; i += 1) await continueDispatch(deps, first);
    const done = await dispatchOf(first);
    assert.equal(done.expand_cursor, MESSAGE_EXPAND_DONE);
    assert.deepEqual(await delivered(first), [a, b].sort());
    assert.equal(done.recipient_count, 2);
    assert.equal(done.status, "completed");

    // 送り始めの人数の上限は 409(送信を作らない)
    memberLimit = 1;
    await assert.rejects(send(), (error) => code(error, 409));
    // 固定の時に上限を超えた・門が閉 → cancelled + cancelReason(配達・一覧なし)
    memberLimit = 100;
    const overAtFreeze = await send();
    memberLimit = 1;
    await continueDispatch(deps, overAtFreeze);
    memberLimit = 100;
    const closedAtFreeze = await send();
    groupsOpen = false;
    await continueDispatch(deps, closedAtFreeze).catch(() => null);
    groupsOpen = true;
    for (const [id, reason] of [
      [overAtFreeze, /上限/],
      [closedAtFreeze, /閉じています/],
    ] as const) {
      const row = await dispatchOf(id);
      assert.equal(row.status, "cancelled");
      assert.equal(row.expand_cursor, MESSAGE_EXPAND_DONE);
      assert.match(String((row.metadata as { cancelReason?: string } | null)?.cancelReason), reason);
      assert.deepEqual(await listed(id), []);
      assert.deepEqual(await delivered(id), []);
    }

    // 全員・ロールの送り始めの線: later は線より後の登録なので引かない(一覧の最後に並ぶ id の位置から)
    const cursor = `${prefix}0000`;
    const withoutLine = await drizzleMessageSendStore.listUserIds({}, cursor, 10);
    assert.ok(withoutLine.userIds.includes(later));
    const withLine = await drizzleMessageSendStore.listUserIds({ createdBefore: new Date() }, cursor, 10);
    assert.deepEqual(withLine.userIds, [a, b, c].sort());
  });
});
