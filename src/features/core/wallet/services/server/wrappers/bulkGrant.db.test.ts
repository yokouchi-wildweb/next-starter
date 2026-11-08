// src/features/core/wallet/services/server/wrappers/bulkGrant.db.test.ts
// 一括付与と補填(bulkGrant)の実 DB テスト: 人ごとの額・1 つの束・種類と区分・飛ばす人・先に止める・全部戻す・お知らせ・束ごとの取り消し。
// 開発 DB に一時のユーザー(provider_uid `test-bulk-grant:<乱数>`)を作り、終了時にユーザー(財布・ロットは cascade)・履歴・お知らせを消す。
// 監査の行は残る。DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test --db src/features/core/wallet/services/server/wrappers/bulkGrant.db.test.ts

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

type Mod = typeof import("./bulkGrant");
type HistoryRow = { user_id: string; points_delta: number; reason_category: string; reason_key: string | null; request_batch_id: string | null; source_type: string };

const TAG = `test-bulk-grant:${randomUUID().slice(0, 8)}`;
const WALLET = "regular_coin" as const;
let mod: Mod;
let reverse: (typeof import("./reverseHistory"))["reverseHistory"];
let asSystem: <T>(fn: () => Promise<T>) => Promise<T>;
let makeUser: (over?: Record<string, unknown>) => Promise<string>;
let balanceOf: (userId: string) => Promise<number>;
let historiesOfBatch: (batch: string) => Promise<HistoryRow[]>;
let noticesOf: (userId: string) => Promise<number>;
let notificationOpen: boolean;
let cleanup: () => Promise<void>;

describe("bulkGrant(実 DB)", { skip }, () => {
  before(async () => {
    mod = await import("./bulkGrant");
    reverse = (await import("./reverseHistory")).reverseHistory;
    const { runAsSystem } = await import("@/lib/audit");
    asSystem = (fn) => runAsSystem(fn);
    const { gate } = await import("@/featureGate");
    notificationOpen = gate.enabled("notification");
    const { db } = await import("@/lib/drizzle");
    const { and, eq, inArray, like, sql } = await import("drizzle-orm");
    const { UserTable } = await import("@/features/core/user/entities/drizzle");
    const { USER_PROVIDER_TYPES } = await import("@/features/core/user/constants");
    const { WalletTable } = await import("@/features/core/wallet/entities/drizzle");
    const { WalletHistoryTable } = await import("@/features/core/walletHistory/entities/drizzle");
    const { NotificationTable } = await import("@/features/core/notification/entities/drizzle");
    makeUser = async (over = {}) => {
      const [row] = await db
        .insert(UserTable)
        .values({ providerType: USER_PROVIDER_TYPES[0], providerUid: `${TAG}:${randomUUID()}`, role: "user", status: "active", ...over })
        .returning({ id: UserTable.id });
      return row.id;
    };
    balanceOf = async (userId) =>
      (await db.select().from(WalletTable).where(and(eq(WalletTable.user_id, userId), eq(WalletTable.type, WALLET))))[0]?.balance ?? 0;
    historiesOfBatch = async (batch) =>
      (await db.select().from(WalletHistoryTable).where(eq(WalletHistoryTable.request_batch_id, batch))) as unknown as HistoryRow[];
    noticesOf = async (userId) =>
      (await db.select({ id: NotificationTable.id }).from(NotificationTable).where(sql`${userId} = ANY(${NotificationTable.target_user_ids})`)).length;
    cleanup = async () => {
      const ids = (await db.select({ id: UserTable.id }).from(UserTable).where(like(UserTable.providerUid, `${TAG}:%`))).map((r) => r.id);
      if (ids.length > 0) {
        for (const id of ids) await db.delete(NotificationTable).where(sql`${id} = ANY(${NotificationTable.target_user_ids})`);
        await db.delete(WalletHistoryTable).where(inArray(WalletHistoryTable.user_id, ids));
        await db.delete(UserTable).where(inArray(UserTable.id, ids));
      }
      // 接続を閉じる(開いたままだとテストのプロセスが終わらない)
      await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
    };
  });
  after(async () => {
    if (cleanup) await cleanup();
  });

  test("人ごとの額を 1 つの束で付ける。種類 compensation = 区分 admin_adjustment、飛ばす人(知らない・削除済み)、dry-run は書かない", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const deleted = await makeUser({ deletedAt: new Date() });
    const unknown = randomUUID();
    const params = {
      walletType: WALLET,
      kind: "compensation" as const,
      reason: "障害のお詫び",
      grants: [{ userId: a, amount: 3 }, { userId: b, amount: 10 }, { userId: deleted, amount: 3 }, { userId: unknown, amount: 3 }],
    };
    const dry = await mod.bulkGrant({ ...params, dryRun: true });
    assert.deepEqual([dry.granted.length, dry.total, dry.requestBatchId], [2, 13, null]);
    assert.deepEqual(new Map(dry.skipped.map((s) => [s.userId, s.why])), new Map([[deleted, "削除済み"], [unknown, "知らない id"]]));
    assert.equal(await balanceOf(a), 0, "dry-run は書かない");

    const done = await asSystem(() => mod.bulkGrant(params));
    assert.deepEqual([await balanceOf(a), await balanceOf(b)], [3, 10]);
    const rows = await historiesOfBatch(done.requestBatchId!);
    assert.equal(rows.length, 2);
    for (const row of rows) assert.deepEqual([row.reason_category, row.reason_key, row.source_type], ["admin_adjustment", "compensation", "admin_action"]);

    // 取り消しは束ごと(指令 53)
    await asSystem(() => reverse({ requestBatchId: done.requestBatchId!, reason: "試験の取り消し" }));
    assert.deepEqual([await balanceOf(a), await balanceOf(b)], [0, 0]);
  });

  test("grant = 付与の種類 admin_adjustment。notify はお知らせを 1 人 1 通(お知らせの機能が閉じていれば 0)", async () => {
    const a = await makeUser();
    const done = await asSystem(() => mod.bulkGrant({ walletType: WALLET, kind: "grant", reason: "キャンペーン", grants: [{ userId: a, amount: 5 }], notify: true }));
    const [row] = await historiesOfBatch(done.requestBatchId!);
    assert.deepEqual([row.reason_category, row.reason_key], ["admin_adjustment", "admin_adjustment"]);
    // notified = 送る処理を通った人数(お知らせの機能が閉じていれば送らずに戻るので、どちらでも 1)。実際に届いたかは表で見る
    assert.deepEqual([done.notified, done.notifyFailed], [1, []]);
    assert.equal(await noticesOf(a), notificationOpen ? 1 : 0);
  });

  test("先に止める(何も書かない): 知らない通貨・知らない種類・理由なし・空・重なり・額の誤り・上限超え", async () => {
    const a = await makeUser();
    const ok = { walletType: WALLET, kind: "grant" as const, reason: "x", grants: [{ userId: a, amount: 1 }] };
    await assert.rejects(() => mod.bulkGrant({ ...ok, walletType: "nope" as never }), /知らない通貨/);
    await assert.rejects(() => mod.bulkGrant({ ...ok, kind: "gift" as never }), /知らない種類/);
    await assert.rejects(() => mod.bulkGrant({ ...ok, reason: " " }), /理由/);
    await assert.rejects(() => mod.bulkGrant({ ...ok, grants: [] }), /いません/);
    await assert.rejects(() => mod.bulkGrant({ ...ok, grants: [{ userId: a, amount: 1 }, { userId: a, amount: 2 }] }), /2 回並んで/);
    await assert.rejects(() => mod.bulkGrant({ ...ok, grants: [{ userId: a, amount: 0 }] }), /正の整数/);
    const many = Array.from({ length: mod.MAX_BULK_GRANT_USERS + 1 }, () => ({ userId: randomUUID(), amount: 1 }));
    await assert.rejects(() => mod.bulkGrant({ ...ok, grants: many }), /までです/);
    assert.equal(await balanceOf(a), 0);
  });
});
