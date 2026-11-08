// src/features/core/auth/services/server/postRegistrationMilestones.test.ts
//
// 本登録の後の処理の発火点(runPostRegistrationMilestones)の検査(DB・Firebase なし。milestone と tx を差し替える)。
// - トリガー user_registered を 1 回、利用者の id と payload(user・role・providerType・inviteCode)で、tx 付きで呼ぶ
// - 定義が無ければ tx を開かない
// - 評価・tx の失敗は throw しない(登録を止めない)
// 実行: pnpm test src/features/core/auth/services/server/postRegistrationMilestones.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const evaluateCalls: unknown[][] = [];
let txOpened = 0;
let definitionCount = 1;
let evaluateThrows = false;
let txThrows = false;
const FAKE_TX = { fake: "tx" };

mock.module("@/features/core/milestone/services/server/milestoneRegistry", {
  namedExports: {
    getMilestonesByTrigger: (trigger: string) =>
      trigger === "user_registered" ? Array.from({ length: definitionCount }, (_, i) => ({ key: `m${i}` })) : [],
  },
});
mock.module("@/features/core/milestone/services/server/wrappers/evaluateMilestones", {
  namedExports: {
    evaluateMilestones: async (...args: unknown[]) => {
      evaluateCalls.push(args);
      if (evaluateThrows) throw new Error("milestone exploded");
      return { trigger: args[0], results: [] };
    },
  },
});
mock.module("@/lib/drizzle", {
  namedExports: {
    runWithTransaction: async (_tx: unknown, handler: (tx: unknown) => Promise<unknown>) => {
      txOpened += 1;
      if (txThrows) throw new Error("connection refused");
      return handler(FAKE_TX);
    },
  },
});

let runPostRegistrationMilestones: typeof import("./postRegistrationMilestones").runPostRegistrationMilestones;
before(async () => {
  ({ runPostRegistrationMilestones } = await import("./postRegistrationMilestones"));
});

const user = { id: "u1", role: "user", status: "active" } as never;
const payload = { user, role: "user", providerType: "email", inviteCode: { applied: true } as const };

beforeEach(() => {
  evaluateCalls.length = 0;
  txOpened = 0;
  definitionCount = 1;
  evaluateThrows = false;
  txThrows = false;
  mock.method(console, "error", () => {});
});

test("user_registered を 1 回、利用者の id・payload・tx で評価する", async () => {
  await runPostRegistrationMilestones(payload);
  assert.equal(evaluateCalls.length, 1);
  const [trigger, params, tx] = evaluateCalls[0] as [string, { userId: string; payload: Record<string, unknown> }, unknown];
  assert.equal(trigger, "user_registered");
  assert.equal(params.userId, "u1");
  assert.deepEqual(params.payload, payload);
  assert.equal(tx, FAKE_TX, "付与と記録を同じ tx で確定させる");
});

test("user_registered の定義が無ければ tx を開かない", async () => {
  definitionCount = 0;
  await runPostRegistrationMilestones(payload);
  assert.equal(txOpened, 0);
  assert.equal(evaluateCalls.length, 0);
});

test("評価や tx の失敗は throw しない(登録を止めない)", async () => {
  evaluateThrows = true;
  await assert.doesNotReject(runPostRegistrationMilestones(payload));
  evaluateThrows = false;
  txThrows = true;
  await assert.doesNotReject(runPostRegistrationMilestones(payload));
});
