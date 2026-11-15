// 管理一覧の一括操作の作成関数の検査(jsdom の上で描く。hook・Modal・入力は偽物)。
// - bulkCreateUserGroupAction: 名前を入れて「作る」= 固定の流れを選んだ利用者 id で始める、進み具合の部品、0 人ならボタンを押せない
// - bulkAddToUserGroupAction: 固定のグループを名前で選んで「足す」= mode add、通れば onDone、断られた理由を出す、id は出さない
// 実行: pnpm test src/features/core/userGroup/components/AdminUserGroupBulkActions/AdminUserGroupBulkActions.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const GROUP_ID = "22222222-2222-4222-8222-222222222222";
const events: unknown[] = [];
let addReason: string | null = null;
let addResult: unknown = { added: 2 };
mock.module("@/features/core/userGroup/hooks/useUserGroupFreeze", {
  namedExports: {
    useUserGroupFreeze: () => ({
      progress: { status: "idle" },
      running: false,
      start: async (input: unknown) => void events.push(["start", input]),
      cancel: () => {},
      clear: () => {},
    }),
  },
});
mock.module("@/features/core/userGroup/hooks/useAddToUserGroup", {
  namedExports: {
    useAddToUserGroup: () => ({
      add: async (groupId: string, ids: string[]) => {
        events.push(["add", groupId, ids]);
        return addResult;
      },
      isAdding: false,
      reason: addReason,
      result: null,
      clear: () => {},
    }),
  },
});
mock.module("@/features/core/userGroup/hooks/useUserGroup", {
  namedExports: {
    useUserGroupCriteriaCatalog: () => ({ catalog: { options: { staticGroups: [{ value: GROUP_ID, label: "春の招待" }] } }, error: null }),
  },
});
mock.module("@/components/Overlays/Modal", {
  defaultExport: (props: { open: boolean; children?: ReactNode; footer?: ReactNode }) =>
    props.open ? createElement("section", { "data-testid": "modal" }, props.children as never, props.footer as never) : null,
});
mock.module("@/components/Form/Button", {
  namedExports: {
    Button: (props: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
mock.module("@/components/Form/Input/Manual", {
  namedExports: {
    Input: (props: { onChange: (e: { target: { value: string } }) => void }) =>
      createElement("button", { type: "button", "data-input": "name", onClick: () => props.onChange({ target: { value: "春の招待" } }) }, "name"),
    Textarea: () => createElement("textarea"),
    SelectInput: (props: { options: { value: string; label: string }[]; onChange: (v: string) => void }) =>
      createElement(
        "span",
        null,
        ...props.options.map((o) => createElement("button", { type: "button", key: o.value, onClick: () => props.onChange(o.value) }, `pick:${o.label}`)),
      ),
  },
});
mock.module("@/features/core/userGroup/components/common/UserGroupFreezeProgress", {
  namedExports: { UserGroupFreezeProgress: () => createElement("div", { "data-part": "freeze" }) },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let creators: typeof import("./index");
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  creators = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  events.length = 0;
  addReason = null;
  addResult = { added: 2 };
});

const selection = (ids: string[]) => ({ selectedIds: ids, selectedRows: [], selectedKeys: ids, count: ids.length, clear: () => {} });
const render = async (Component: (props: never) => ReactNode, ids: string[]) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(Component as never, { selection: selection(ids), onDone: () => events.push("done") } as never)));
  return { container, unmount: () => act(async () => root.unmount()) };
};
const click = async (container: HTMLElement, text: string) => {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  assert.ok(button, `button ${text}`);
  await act(async () => button.click());
};
const byText = (container: HTMLElement, text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === text);

test("作る: 名前を入れて作る = 選んだ利用者 id で固定の流れを始める、進み具合の部品", async () => {
  const item = creators.bulkCreateUserGroupAction({ key: "userGroupCreate", lists: ["general"], order: 20 });
  assert.deepEqual([item.key, item.lists, item.order], ["userGroupCreate", ["general"], 20]);
  const view = await render(item.Component as never, ["u1", "u2"]);
  await click(view.container, "選んだ人でグループを作る");
  assert.equal(byText(view.container, "作る")?.disabled, true, "名前が無い間は押せない");
  assert.ok(view.container.querySelector('[data-part="freeze"]'));
  await click(view.container, "name");
  await click(view.container, "作る");
  assert.deepEqual(events, [["start", { name: "春の招待", description: null, from: { type: "users", userIds: ["u1", "u2"] } }]]);
  await view.unmount();
});

test("作る・足す: 0 人ならボタンを押せない", async () => {
  const create = await render(creators.bulkCreateUserGroupAction({ key: "c" }).Component as never, []);
  assert.equal(byText(create.container, "選んだ人でグループを作る")?.disabled, true);
  await create.unmount();
  const add = await render(creators.bulkAddToUserGroupAction({ key: "a" }).Component as never, []);
  assert.equal(byText(add.container, "固定のグループに足す")?.disabled, true);
  await add.unmount();
});

test("足す: 名前で選んで足す = mode add、通れば onDone、id は出さない", async () => {
  const item = creators.bulkAddToUserGroupAction({ key: "userGroupAdd", lists: ["general"], order: 30 });
  const view = await render(item.Component as never, ["u1"]);
  await click(view.container, "固定のグループに足す");
  assert.match(view.container.textContent ?? "", /春の招待/);
  assert.doesNotMatch(view.container.textContent ?? "", new RegExp(GROUP_ID));
  assert.equal(byText(view.container, "足す")?.disabled, true, "選ぶまで押せない");
  await click(view.container, "pick:春の招待");
  await click(view.container, "足す");
  assert.deepEqual(events, [["add", GROUP_ID, ["u1"]], "done"]);
  await view.unmount();
});

test("足す: 断られたらサーバーの理由を出し、onDone しない", async () => {
  addReason = "人数の上限を超えます";
  addResult = null;
  const view = await render(creators.bulkAddToUserGroupAction({ key: "a" }).Component as never, ["u1"]);
  await click(view.container, "固定のグループに足す");
  assert.match(view.container.textContent ?? "", /人数の上限を超えます/);
  await click(view.container, "pick:春の招待");
  await click(view.container, "足す");
  assert.deepEqual(events, [["add", GROUP_ID, ["u1"]]]);
  await view.unmount();
});
