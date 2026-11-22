// src/featureGate/checks/when.test.ts
// 規則の when(D28)と生成物 extensions/whenInputs.ts のずれ: 規則が指した値は全部生成物にあり、生成物は指された値だけ。
// 規則の値は when の値の AND(ruleList.ts)。実行: pnpm test src/featureGate/checks/when.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";

import { rules as generatedRules } from "@/featureGate/extensions/rules";
import { whenInputs } from "@/featureGate/extensions/whenInputs";
import { bankTransferInhouseSelectable } from "@/domains/purchaseRequest/config";

test("when: 規則が指した値と生成物 whenInputs の鍵は同じ集合", () => {
  const referenced = new Set(generatedRules.flatMap((rule) => rule.when));
  assert.deepEqual([...referenced].sort(), Object.keys(whenInputs).sort());
});

test("when: bankTransferReview は purchaseRequest の bankTransferInhouseSelectable を指し、生成物はその値を持つ(規則は値を import しない)", () => {
  const rule = generatedRules.find((r) => r.name === "bankTransferReview");
  assert.deepEqual(rule?.when, ["purchaseRequest.bankTransferInhouseSelectable"]);
  assert.equal(rule?.enabled, undefined);
  assert.equal(whenInputs["purchaseRequest.bankTransferInhouseSelectable"], bankTransferInhouseSelectable);
});
