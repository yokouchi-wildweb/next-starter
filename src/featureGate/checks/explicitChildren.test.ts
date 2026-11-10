// 明示的に開けた子の検査(設定 D121)。判定の純関数と、今の木が通ること。
// 実行: FEATURE_GATE_CHECK=all pnpm test src/featureGate/checks/explicitChildren.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkExplicitChildren, closedParentsOfOpened } from "./explicitChildren";

const list = [
  { name: "wallet", dependsOn: [] },
  { name: "payment", dependsOn: ["wallet"] },
  { name: "bankTransferReview", dependsOn: ["payment"] },
  { name: "mypageOther", dependsOn: ["pageMypage"] },
  { name: "pageMypage", dependsOn: [] },
];

test("開けた子の親が開なら通る / 親が閉なら失敗し、直し方 2 つを出す", () => {
  assert.deepEqual(closedParentsOfOpened(list, ["payment"], () => true), []);
  const [problem, ...rest] = closedParentsOfOpened(list, ["payment"], (name) => name !== "wallet");
  assert.equal(rest.length, 0);
  assert.match(problem, /機能 payment を switches\.config\.ts で開けたが、依存先 wallet が閉/);
  assert.match(problem, /pnpm ops features set wallet on/);
  assert.match(problem, /switches\.config\.ts から payment の行を消す/);
});

test("推移的: 孫を開けて祖父が閉なら失敗", () => {
  const [problem] = closedParentsOfOpened(list, ["bankTransferReview"], (name) => name !== "wallet");
  assert.match(problem, /依存先 wallet が閉/);
});

test("開けていない子(上流の既定で開の子)は見ない", () => {
  assert.deepEqual(closedParentsOfOpened(list, [], () => false), []);
  assert.deepEqual(closedParentsOfOpened(list, ["wallet"], () => false), [], "依存先の無い機能は対象外");
});

test("今の木: switches で開けた子の親はどれも開(上流は switches が空)", () => {
  assert.deepEqual(checkExplicitChildren().problems, []);
});
