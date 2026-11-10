// UserListHeader の並び替えの候補の検査(子の部品は偽物。SortSelect に渡った値を見る):
// 既定 = 登録日順・更新日順 + 既定値 createdAt / sortOptions・defaultSort を渡すとそれが届く
// 実行: pnpm test src/features/core/user/components/common/UserListHeader.test.tsx
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

const { createElement } = require("react") as typeof import("react");

type SortSelectProps = { options: { label: string; value: string }[]; selected?: string; defaultValue?: string };
let received: SortSelectProps | null = null;

mock.module("next/navigation", { namedExports: { useSearchParams: () => new URLSearchParams() } });
mock.module("@/components/AppFrames/Admin/Elements/ListTop", {
  defaultExport: ({ children }: { children: unknown }) => createElement("div", null, children as never),
});
mock.module("@/components/AppFrames/Admin/Elements/SortSelect", {
  defaultExport: (props: SortSelectProps) => {
    received = props;
    return null;
  },
});
mock.module("@/components/AppFrames/Admin/Elements/SearchBox", { defaultExport: () => null });
mock.module("@/components/Navigation", { namedExports: { Pagination: () => null } });
mock.module("@/lib/crud/components/Buttons", { namedExports: { CreateButton: () => null } });

let UserListHeader: typeof import("./UserListHeader").default;
let DEFAULT_USER_LIST_SORT_OPTIONS: typeof import("./UserListHeader").DEFAULT_USER_LIST_SORT_OPTIONS;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  ({ default: UserListHeader, DEFAULT_USER_LIST_SORT_OPTIONS } = await import("./UserListHeader"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});
beforeEach(() => {
  received = null;
});

const baseProps = { listPath: "/admin/users/general", page: 1, perPage: 20, total: 0 };

test("既定: 登録日順・更新日順、既定値 createdAt", () => {
  renderToStaticMarkup(createElement(UserListHeader, baseProps));
  assert.deepEqual(received?.options, [
    { label: "登録日順", value: "createdAt" },
    { label: "更新日順", value: "updatedAt" },
  ]);
  assert.equal(received?.options, DEFAULT_USER_LIST_SORT_OPTIONS);
  assert.equal(received?.defaultValue, "createdAt");
});

test("sortOptions / defaultSort を渡すと、それが SortSelect に届く", () => {
  const options = [...DEFAULT_USER_LIST_SORT_OPTIONS, { label: "保有コイン順", value: "coinBalance" }];
  renderToStaticMarkup(createElement(UserListHeader, { ...baseProps, sortOptions: options, defaultSort: "coinBalance", sortBy: "updatedAt" }));
  assert.equal(received?.options, options);
  assert.equal(received?.defaultValue, "coinBalance");
  assert.equal(received?.selected, "updatedAt");
});
