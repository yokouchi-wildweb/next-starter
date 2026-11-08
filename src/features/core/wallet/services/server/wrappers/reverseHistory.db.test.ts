// src/features/core/wallet/services/server/wrappers/reverseHistory.db.test.ts
// 取引の取り消し(reverseHistory)の実 DB テスト: 逆向きの行・同じ区分と種類・束ごと 1 transaction・止める場合(何も書かない)。
// 開発 DB に一時のユーザー(provider_uid `test-reverse:<乱数>`)と財布を作り、終了時にユーザー(財布・ロットは cascade)と履歴を消す。
// 監査の行(wallet.balance.adjusted)は残る(監査は消さない)。DATABASE_URL が無ければ全件 skip。
// 実行: pnpm test --db src/features/core/wallet/services/server/wrappers/reverseHistory.db.test.ts

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

const envFile = resolve(process.cwd(), process.env.ENV_FILE ?? ".env.development");
if (existsSync(envFile)) loadEnv({ path: envFile, quiet: true });

const skip = (process.env.DATABASE_URL ?? "").trim().length === 0;

type Mod = typeof import("./reverseHistory");
type Adjust = typeof import("./adjustBalance");

const WALLET = "regular_coin" as const;
let mod: Mod;
let adjust: Adjust["adjustBalance"];
let asSystem: <T>(fn: () => Promise<T>) => Promise<T>;
let userId: string;
let historyOf: (id: string) => Promise<Record<string, unknown> | undefined>;
let rowsOfUser: () => Promise<Array<Record<string, unknown>>>;
let balance: () => Promise<number>;
let cleanup: () => Promise<void>;

const grant = async (amount: number, extra: Partial<Parameters<Adjust["adjustBalance"]>[0]> = {}) =>
  (await asSystem(() => adjust({ userId, walletType: WALLET, changeMethod: "INCREMENT", amount, sourceType: "admin_action", reason: "test", ...extra }))).history!;

describe("reverseHistory(実 DB)", { skip }, () => {
  before(async () => {
    mod = await import("./reverseHistory");
    adjust = (await import("./adjustBalance")).adjustBalance;
    const { runAsSystem } = await import("@/lib/audit/context");
    asSystem = (fn) => runAsSystem(fn);
    const { db } = await import("@/lib/drizzle");
    const { eq, and } = await import("drizzle-orm");
    const { UserTable } = await import("@/features/core/user/entities/drizzle");
    const { USER_PROVIDER_TYPES } = await import("@/features/core/user/constants");
    const { WalletTable } = await import("@/features/core/wallet/entities/drizzle");
    const { WalletHistoryTable } = await import("@/features/core/walletHistory/entities/drizzle");
    const [user] = await db
      .insert(UserTable)
      .values({ providerType: USER_PROVIDER_TYPES[0], providerUid: `test-reverse:${randomUUID()}`, role: "user", status: "active" })
      .returning({ id: UserTable.id });
    userId = user.id;
    historyOf = async (id) => (await db.select().from(WalletHistoryTable).where(eq(WalletHistoryTable.id, id)))[0];
    rowsOfUser = async () => db.select().from(WalletHistoryTable).where(eq(WalletHistoryTable.user_id, userId));
    balance = async () =>
      (await db.select().from(WalletTable).where(and(eq(WalletTable.user_id, userId), eq(WalletTable.type, WALLET))))[0]?.balance ?? 0;
    cleanup = async () => {
      await db.delete(WalletHistoryTable).where(eq(WalletHistoryTable.user_id, userId));
      await db.delete(UserTable).where(eq(UserTable.id, userId));
      // 接続を閉じる(開いたままだとテストのプロセスが終わらない)
      await (db as unknown as { $client?: { end: () => Promise<void> } }).$client?.end();
    };
  });
  after(async () => {
    if (cleanup) await cleanup();
  });

  test("1 行: INCREMENT を DECREMENT で打ち消し、同じ区分・種類、meta.reversesHistoryId、source admin_action。dry-run は書かない", async () => {
    const original = await grant(100, { reasonCategory: "bonus", reasonKey: "coupon_attribution_reward" });
    const before = await balance();
    const dry = await mod.reverseHistory({ historyIds: [original.id], reason: "付与の誤り", dryRun: true });
    assert.deepEqual([dry.dryRun, dry.rows[0].delta, dry.rows[0].balanceAfter, dry.rows[0].newHistoryId], [true, -100, before - 100, null]);
    assert.equal(await balance(), before, "dry-run は書かない");

    const done = await asSystem(() => mod.reverseHistory({ historyIds: [original.id], reason: "付与の誤り" }));
    assert.equal(await balance(), before - 100);
    const reversal = await historyOf(done.rows[0].newHistoryId!);
    assert.deepEqual(
      [reversal?.change_method, reversal?.points_delta, reversal?.reason_category, reversal?.reason_key, reversal?.source_type, reversal?.reason, reversal?.request_batch_id],
      ["DECREMENT", 100, "bonus", "coupon_attribution_reward", "admin_action", "付与の誤り", done.requestBatchId],
    );
    assert.equal((reversal?.meta as Record<string, unknown>)[mod.REVERSES_HISTORY_META_KEY], original.id);
  });

  test("区分・種類ごとの純額(balance_after - balance_before の和、coin issuance と同じ式)で元の行が打ち消される", async () => {
    const sums = new Map<string, number>();
    for (const row of await rowsOfUser()) {
      const key = `${row.reason_category}/${row.reason_key}`;
      sums.set(key, (sums.get(key) ?? 0) + (Number(row.balance_after) - Number(row.balance_before)));
    }
    assert.equal(sums.get("bonus/coupon_attribution_reward"), 0);
  });

  test("束(request_batch_id): 全部の行を 1 つの取り消しの束で打ち消す(INCREMENT と DECREMENT が混ざってもよい)", async () => {
    const batch = randomUUID();
    await grant(50, { requestBatchId: batch });
    await asSystem(() => adjust({ userId, walletType: WALLET, changeMethod: "DECREMENT", amount: 20, sourceType: "admin_action", reason: "test", requestBatchId: batch }));
    const before = await balance();
    const done = await asSystem(() => mod.reverseHistory({ requestBatchId: batch, reason: "一括の誤り" }));
    assert.deepEqual(done.rows.map((r) => r.delta), [20, -50], "新しい行から戻す(作った順だと途中で残高が足りない)");
    assert.equal(await balance(), before - 30);
    const written = await Promise.all(done.rows.map((r) => historyOf(r.newHistoryId!)));
    assert.equal(new Set(written.map((r) => r?.request_batch_id)).size, 1, "取り消しの行は 1 つの束");
  });

  test("止める(何も書かない): SET・取り消しの行・既に取り消した行・知らない id・空の束・重なり・理由なし・両方の指定・残高不足", async () => {
    const refused = async (params: Parameters<Mod["reverseHistory"]>[0], why: RegExp) => {
      const rows = (await rowsOfUser()).length;
      const bal = await balance();
      await assert.rejects(() => asSystem(() => mod.reverseHistory(params)), why);
      assert.deepEqual([(await rowsOfUser()).length, await balance()], [rows, bal], "何も書かない");
    };
    const set = (await asSystem(() => adjust({ userId, walletType: WALLET, changeMethod: "SET", amount: 500, sourceType: "admin_action", reason: "test" }))).history!;
    await refused({ historyIds: [set.id], reason: "x" }, /SET/);

    const g = await grant(10);
    const first = await asSystem(() => mod.reverseHistory({ historyIds: [g.id], reason: "x" }));
    await refused({ historyIds: [g.id], reason: "x" }, /既に取り消しています/);
    await refused({ historyIds: [first.rows[0].newHistoryId!], reason: "x" }, /取り消しの行そのもの/);
    await refused({ historyIds: [randomUUID()], reason: "x" }, /知らない行の id/);
    await refused({ requestBatchId: randomUUID(), reason: "x" }, /の行がありません/);
    const g2 = await grant(5);
    await refused({ historyIds: [g2.id, g2.id], reason: "x" }, /重なっています/);
    await refused({ historyIds: [g2.id], reason: " " }, /理由/);
    await refused({ historyIds: [g2.id], requestBatchId: randomUUID(), reason: "x" }, /どちらか一方/);

    // 残高不足: 付けた分を先に使い切ると、取り消しの DECREMENT は残高が足りない。束の他の行も書かない
    const big = await grant(1000);
    await asSystem(() => adjust({ userId, walletType: WALLET, changeMethod: "SET", amount: 0, sourceType: "admin_action", reason: "test" }));
    await refused({ historyIds: [g2.id, big.id], reason: "x" }, /利用可能な残高が足りません/);
  });
});
