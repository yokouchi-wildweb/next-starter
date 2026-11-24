// 一括操作の項目の読み手 useDomainAdminBulkActions の検査(一覧と門番は偽物、server の描画で hook を 1 回回す)。
// - 効く一覧 = 項目の domain、省略なら差したドメイン: ほかのドメイン(fork の自分のドメイン)から domain で上流の一覧へ差せる
// - domain を名乗った項目は差したドメインの一覧には出ない
// - 門番で外れた項目(差したドメインが閉じた)は出ない
// 実行: pnpm test src/domains/core/admin/hooks/useDomainAdminBulkActions.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";

const item = (key: string, domain?: string) => ({ key, Component: () => null, ...(domain ? { domain } : {}) });

const LIST = [
  { domain: "bankTransferReview", name: "sendEmail", requires: [], plug: item("sendEmail") },
  { domain: "bankTransferReviewBulk", name: "bulkDecision", requires: [], plug: item("bulkDecision", "bankTransferReview") },
  { domain: "closedFork", name: "hidden", requires: [], plug: item("hidden", "bankTransferReview") },
  { domain: "user", name: "userTags", requires: [], plug: item("userTags") },
];

mock.module("@/domains/core/admin/extensions/adminBulkActions", { namedExports: { adminBulkActions: LIST } });
// 門番の偽物: 閉じたドメイン closedFork の項目を外す(useGate().plugs の写し)
mock.module("@/featureGate/client", {
  namedExports: { useGate: () => ({ plugs: (list: typeof LIST) => list.filter((entry) => entry.domain !== "closedFork") }) },
});

let render: (node: ReactNode) => string;
let useDomainAdminBulkActions: typeof import("./useDomainAdminBulkActions").useDomainAdminBulkActions;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ useDomainAdminBulkActions } = await import("./useDomainAdminBulkActions"));
});

/** その一覧のドメインで hook を回し、項目の key を返す */
function keysOf(domain: string): string[] {
  let keys: string[] = [];
  const Probe = () => {
    keys = useDomainAdminBulkActions(domain).map((entry) => entry.key);
    return null;
  };
  render(createElement(Probe));
  return keys;
}

test("効く一覧 = 項目の domain(省略なら差したドメイン): fork の自分のドメインの項目が上流の一覧に出る", () => {
  assert.deepEqual(keysOf("bankTransferReview"), ["sendEmail", "bulkDecision"]);
});

test("domain を名乗った項目は差したドメインの一覧に出ない。名乗らない項目は今と同じ", () => {
  assert.deepEqual(keysOf("bankTransferReviewBulk"), []);
  assert.deepEqual(keysOf("user"), ["userTags"]);
});

test("差したドメインが閉じた項目は門番が外す(効く先の一覧でも出ない)", () => {
  assert.ok(!keysOf("bankTransferReview").includes("hidden"));
});
