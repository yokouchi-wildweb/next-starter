// scripts/extensions/upstreamItems.test.mts
// 拡張点へ移した上流の項目が、何も足さない状態で今までどおり動くことの回帰テスト(DB は使わない)。
// - 退会の後片付け: 必須 → 任意の順、必須の失敗は投げる、任意の失敗は続行、enabled false は走らない。上流の項目の組
// - コイン創出のソース: enabled false は外す。上流の項目の組(一覧の順 = ファイル名の順)
// - 読み込み: 項目と読み手が互いを読み合っても、どの入口から読んでも壊れない(入口ごとに別プロセス)
// 実行: pnpm test:extension-items

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

import { onDemoUserCreated } from "@/features/core/auth/services/server/onDemoUserCreated";
import { getCouponIssuerProgram, isCouponIssuerProgramEnabled } from "@/features/core/couponIssuerGrant/services/server/program";
import { getPaymentSessionEnricher } from "@/features/core/purchaseRequest/services/server/payment/getSessionEnricher";
import { activeCoinIssuanceSources } from "@/features/core/analytics/services/server/coinIssuance/activeSources";
import type { CoinIssuanceSource } from "@/features/core/analytics/services/server/coinIssuance/types";
import { runCleanupItems } from "@/features/core/user/services/server/cleanup";

import { itemsOf, planExtensions } from "./extensions.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const tx = {} as never;

test("後片付け: 必須 → 任意の順、無効は走らない、任意の失敗は続行", async () => {
  const log: string[] = [];
  const item = (name: string, required: boolean, enabled?: () => boolean, fail = false) => ({
    required,
    enabled,
    run: async () => {
      log.push(name);
      if (fail) throw new Error(name);
    },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    await runCleanupItems(
      [item("optA", false, undefined, true), item("reqOff", true, () => false), item("req", true), item("optB", false), item("optOff", false, () => false)],
      "u1",
      tx,
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(log, ["req", "optA", "optB"]);
});

test("後片付け: 必須の失敗はそのまま投げ、後の項目は走らない(トランザクションのロールバック)", async () => {
  const log: string[] = [];
  await assert.rejects(
    runCleanupItems(
      [
        { required: true, run: async () => { throw new Error("boom"); } },
        { required: false, run: async () => { log.push("opt"); } },
      ],
      "u1",
      tx,
    ),
    /boom/,
  );
  assert.deepEqual(log, []);
});

test("コイン創出: enabled false のソースは外し、省略は常に入る", () => {
  const source = (key: string, enabled?: () => boolean) => ({ key, kind: "issuance", enabled, aggregate: async () => ({}) }) as unknown as CoinIssuanceSource;
  assert.deepEqual(activeCoinIssuanceSources([source("a"), source("b", () => false), source("c", () => true)]).map((s) => s.key), ["a", "c"]);
});

test("上流の項目の組: 宣言と受け口がそろい、機能に閉じる項目は enabled を持つ", () => {
  const plan = planExtensions(ROOT);
  assert.deepEqual(plan.problems, [], plan.problems.join("\n"));
  const names = (owner: string, point: string) => itemsOf(plan, owner, point).map((i: { name: string }) => i.name);
  assert.deepEqual(names("src/features/core/user", "cleanupHandlers"), ["purchaseRequest", "wallet"]);
  assert.deepEqual(names("src/features/core/analytics", "coinIssuanceSources"), ["couponAttributionReward", "purchaseBonusGap", "referralReward"]);
  assert.deepEqual(names("src/features/core/analytics", "rollupMetrics"), []);
  assert.deepEqual(names("src/features/core/user", "reservedNames"), []);
  assert.deepEqual(names("src/features/core/purchaseRequest", "completionStrategies"), ["walletTopup"]);
  assert.deepEqual(names("src/features/core/batchJob", "jobHandlers"), ["walletBulkAdjust"]);
});

test("1 行スイッチの既定: 何も足さない状態で今までと同じ(エンリッチャーなし・プログラムなし・フックは何もしない)", async () => {
  assert.equal(getPaymentSessionEnricher(), null);
  assert.equal(getCouponIssuerProgram(), null);
  assert.equal(isCouponIssuerProgramEnabled(), false);
  assert.equal(await onDemoUserCreated("u1"), undefined);
  const plan = planExtensions(ROOT);
  assert.deepEqual(plan.switches.map((s: { target: string }) => s.target).sort(), ["onDemoUserCreated.default", "programConfig.default", "sessionEnricher.default"]);
});

const ENTRIES = [
  ["src/features/core/purchaseRequest/services/server/completion/index.ts", "getPurchaseCompletionStrategy", "wallet_topup"],
  ["src/features/core/purchaseRequest/services/server/completion/strategies/walletTopup.ts", null, null],
  ["src/features/core/purchaseRequest/services/server/wrappers/purchaseService.ts", null, null],
  ["src/features/core/batchJob/services/server/index.ts", "getHandler", "wallet_bulk_adjust"],
  ["src/features/core/batchJob/jobHandlers/walletBulkAdjust.ts", null, null],
  ["src/features/core/wallet/services/server/handlers/walletBulkAdjustHandler.ts", null, null],
  ["src/features/core/wallet/services/server/walletService.ts", null, null],
  ["src/features/core/milestone/services/server/wrappers/evaluateMilestones.ts", null, null],
  ["src/features/core/referralReward/services/server/referralRewardService.ts", null, null],
] as const;

for (const [entry, fn, arg] of ENTRIES) {
  test(`読み込み: ${entry} から読んでも壊れない${fn ? `、${fn}("${arg}") が引ける` : ""}`, () => {
    const code = `const m = await import(${JSON.stringify(`${ROOT}/${entry}`)});${fn ? `const r = m.${fn}(${JSON.stringify(arg)}); if (!r) throw new Error("not found");` : ""}process.exit(0);`;
    const result = spawnSync("npx", ["tsx", "--import", "./scripts/test/serverOnlyStub.mjs", "--input-type=module", "-e", code], { cwd: ROOT, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } });
    assert.equal(result.status, 0, result.stderr.slice(-1500));
  });
}
