// 管理一覧の一括操作の作成関数の検査(jsdom の上で描く。hook・Modal・入力は偽物)。
// - bulkCreateUserGroupAction: 名前を入れて「作る」= 固定の流れを選んだ利用者 id で始める、進み具合の部品、0 人ならボタンを押せない
// - bulkAddToUserGroupAction: 固定のグループを名前で選んで「足す」= mode add、通れば onDone、断られた理由を出す、id は出さない
// - 終わったらグループ名と人数のトースト(作る・足す)
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
let addResult: unknown = { added: 2, skipped: 1, memberCount: 5, group: { name: "春の招待" } };
let freezeOnDone: ((group: unknown) => void) | undefined;
const toasts: string[] = [];
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: (message: string) => void toasts.push(message) }) } });
mock.module("@/features/core/userGroup/hooks/useUserGroupFreeze", {
  namedExports: {
    useUserGroupFreeze: (options: { onDone?: (group: unknown) => void }) => ({
      progress: { status: "idle" },
      running: false,
      start: async (input: unknown) => {
        freezeOnDone = options.onDone;
        events.push(["start", input]);
      },
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
mock.module("@/components/Button/Button", {
  namedExports: {
    Button: (props: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
      createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick }, props.children as never),
  },
});
mock.module("@/components/Input/Input", {
  namedExports: {
    Input: (props: { onChange: (e: { target: { value: string } }) => void }) =>
      createElement("button", { type: "button", "data-input": "name", onClick: () => props.onChange({ target: { value: "春の招待" } }) }, "name"),
  },
});
mock.module("@/components/Input/Textarea", {
  namedExports: {
    Textarea: () => createElement("textarea"),
  },
});
mock.module("@/components/Input/Select", {
  namedExports: {
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
  addResult = { added: 2, skipped: 1, memberCount: 5, group: { name: "春の招待" } };
  toasts.length = 0;
  freezeOnDone = undefined;
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
  await click(view.container, "選択したユーザーでグループを作成");
  assert.equal(byText(view.container, "作成")?.disabled, true, "名前が無い間は押せない");
  assert.ok(view.container.querySelector('[data-part="freeze"]'));
  await click(view.container, "name");
  await click(view.container, "作成");
  assert.deepEqual(events, [["start", { name: "春の招待", description: null, from: { type: "users", userIds: ["u1", "u2"] } }]]);
  await act(async () => freezeOnDone?.({ name: "春の招待", count: { value: 2, state: "counted" } }));
  assert.deepEqual(toasts, ["「春の招待」を作成しました(2 人)"]);
  assert.deepEqual(events.at(-1), "done");
  await view.unmount();
});

test("作る・足す: 0 人ならボタンを押せない", async () => {
  const create = await render(creators.bulkCreateUserGroupAction({ key: "c" }).Component as never, []);
  assert.equal(byText(create.container, "選択したユーザーでグループを作成")?.disabled, true);
  await create.unmount();
  const add = await render(creators.bulkAddToUserGroupAction({ key: "a" }).Component as never, []);
  assert.equal(byText(add.container, "固定グループに追加")?.disabled, true);
  await add.unmount();
});

test("足す: 名前で選んで足す = mode add、通れば onDone、id は出さない", async () => {
  const item = creators.bulkAddToUserGroupAction({ key: "userGroupAdd", lists: ["general"], order: 30 });
  const view = await render(item.Component as never, ["u1"]);
  await click(view.container, "固定グループに追加");
  assert.match(view.container.textContent ?? "", /春の招待/);
  assert.doesNotMatch(view.container.textContent ?? "", new RegExp(GROUP_ID));
  assert.equal(byText(view.container, "追加")?.disabled, true, "選ぶまで押せない");
  await click(view.container, "pick:春の招待");
  await click(view.container, "追加");
  assert.deepEqual(events, [["add", GROUP_ID, ["u1"]], "done"]);
  assert.deepEqual(toasts, ["「春の招待」に 2 人を追加しました(1 人は登録済みか、追加できませんでした)"]);
  await view.unmount();
});

test("足す: 断られたらサーバーの理由を出し、onDone しない", async () => {
  addReason = "人数の上限を超えます";
  addResult = null;
  const view = await render(creators.bulkAddToUserGroupAction({ key: "a" }).Component as never, ["u1"]);
  await click(view.container, "固定グループに追加");
  assert.match(view.container.textContent ?? "", /人数の上限を超えます/);
  await click(view.container, "pick:春の招待");
  await click(view.container, "追加");
  assert.deepEqual(events, [["add", GROUP_ID, ["u1"]]]);
  assert.deepEqual(toasts, [], "断られたらトーストを出さない");
  await view.unmount();
});
