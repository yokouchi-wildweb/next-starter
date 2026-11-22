// 利用者一覧の一括操作の項目 userGroupCreate / userGroupAdd の検査(門・ロールの絞りは偽物)。
// - 2 つとも一般の一覧(general)だけ、order 20 / 30、門 userGroups(feature)
// - useUserAdminBulkActions("general"): 門が開なら出る / userGroups が閉なら出ない。system・demo の一覧には出ない
// - 部品も門を確かめる: 閉なら何も描かない
// 実行: pnpm test src/domains/core/user/plugs/adminBulkActions/userGroupItems.test.tsx
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";

const closed = new Set<string>();
mock.module("@/featureGate/client", {
  namedExports: { useGate: () => ({ enabled: (name: string) => !closed.has(name), plugs: <T,>(items: readonly T[]) => [...items] }) },
});
mock.module("@/domains/core/user/hooks/useAdminBulkActionCan", {
  namedExports: { useAdminBulkActionCan: () => () => true },
});

// user の一覧の項目(点 adminBulkActions は core/admin の 1 点。user の物を key の表に)
let adminBulkActions: Record<string, import("@/domains/core/user/types").UserAdminBulkActionItem>;
let useUserAdminBulkActions: typeof import("../../hooks/useUserAdminBulkActions").useUserAdminBulkActions;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  const { adminBulkActions: all } = await import("@/domains/core/admin/extensions/adminBulkActions");
  adminBulkActions = Object.fromEntries(all.filter((entry) => entry.domain === "user").map((entry) => [entry.plug.key, entry.plug as import("@/domains/core/user/types").UserAdminBulkActionItem]));
  ({ useUserAdminBulkActions } = await import("../../hooks/useUserAdminBulkActions"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});
beforeEach(() => closed.clear());

const keysFor = (list: "general" | "managerial" | "demo") => {
  const seen: { keys: string[] } = { keys: [] };
  const Probe = ({ report }: { report: (keys: string[]) => void }) => {
    report(useUserAdminBulkActions(list).map((item) => item.key));
    return null;
  };
  renderToStaticMarkup(createElement(Probe, { report: (keys) => (seen.keys = keys) }));
  return seen.keys;
};

test("項目: 一般の一覧だけ、order 20 / 30、門 userGroups", () => {
  const create = adminBulkActions.userGroupCreate;
  const add = adminBulkActions.userGroupAdd;
  assert.deepEqual([create.lists, create.order, create.feature], [["general"], 20, "userGroups"]);
  assert.deepEqual([add.lists, add.order, add.feature], [["general"], 30, "userGroups"]);
});

test("useUserAdminBulkActions: 門が開なら出て、userGroups が閉なら出ない。ほかの一覧には出ない", () => {
  const open = keysFor("general");
  assert.ok(open.includes("userGroupCreate") && open.includes("userGroupAdd"));
  assert.ok(open.indexOf("userGroupCreate") < open.indexOf("userGroupAdd"));
  closed.add("userGroups");
  const shut = keysFor("general");
  assert.ok(!shut.includes("userGroupCreate") && !shut.includes("userGroupAdd"));
  closed.clear();
  assert.ok(!keysFor("managerial").includes("userGroupCreate"));
  assert.ok(!keysFor("demo").includes("userGroupAdd"));
});

test("部品: 門 userGroups が閉なら何も描かない / 開ならボタン", () => {
  const props = { selection: { selectedIds: ["u1"], selectedRows: [], selectedKeys: ["u1"], count: 1, clear: () => {} }, onDone: () => {} };
  const html = (key: string) => renderToStaticMarkup(createElement(adminBulkActions[key].Component, props as never));
  assert.match(html("userGroupCreate"), /選択したユーザーでグループを作成/);
  assert.match(html("userGroupAdd"), /固定グループに追加/);
  closed.add("userGroups");
  assert.equal(html("userGroupCreate"), "");
  assert.equal(html("userGroupAdd"), "");
});
