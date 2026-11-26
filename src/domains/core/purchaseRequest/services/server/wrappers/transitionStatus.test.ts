// 購入の status の許可表(ALLOWED_TRANSITIONS)と、その逆引き statusesInto(completePurchase の楽観ロックの条件)の検査。
// 実行: pnpm test src/domains/core/purchaseRequest/services/server/wrappers/transitionStatus.test.ts
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";

// DB には触れない(許可表と逆引きだけを見る)
mock.module("@/lib/drizzle", { namedExports: { db: {} } });

type Mod = typeof import("./transitionStatus");
let ALLOWED_TRANSITIONS: Mod["ALLOWED_TRANSITIONS"];
let statusesInto: Mod["statusesInto"];
before(async () => {
  ({ ALLOWED_TRANSITIONS, statusesInto } = await import("./transitionStatus"));
});

test("完了へ行けるのは processing・failed(順序逆転の救済)・expired(窓が閉じた後に払いが確かめられた物)", () => {
  assert.deepEqual(statusesInto("completed").sort(), ["expired", "failed", "processing"]);
});

test("completed は終端、expired から行けるのは completed だけ", () => {
  assert.deepEqual(ALLOWED_TRANSITIONS.completed, []);
  assert.deepEqual(ALLOWED_TRANSITIONS.expired, ["completed"]);
});
