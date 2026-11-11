// createGeneralUserListColumns の検査(部品は文字だけを返す偽物に差し替え、列の並びと操作のセルの中身を見る):
// 列の見出しと並び(メモの有無)・操作のセル(ポイント操作・管理 / 削除・処理中・編集の飛び先)・押下で handler が呼ばれる
// 実行: pnpm test src/features/core/user/components/admin/GeneralUserList/columns.test.tsx
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement, ReactNode } from "react";

import type { User } from "@/features/core/user/entities";

import type { GeneralUserListColumnOptions } from "./columns";

const { createElement, Fragment } = require("react") as typeof import("react");

mock.module("@/lib/tableSuite", {
  namedExports: { TableCellAction: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children) },
});
mock.module("@/components/Form/Button/Button", {
  namedExports: {
    Button: (props: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) =>
      createElement("button", { "data-variant": props.variant, disabled: props.disabled, onClick: props.onClick }, props.children),
  },
});
mock.module("@/lib/crud/components/Buttons", {
  namedExports: { EditButton: ({ href }: { href: string }) => createElement("a", { href }, "編集") },
});
mock.module("@/features/core/user/components/common/UserAdminMemoCell", {
  namedExports: { UserAdminMemoCell: ({ memo }: { memo: string | null }) => createElement("span", null, memo ?? "") },
});
mock.module("@/features/core/user/entities/display", { namedExports: { domainDisplay: {} } });
// 列が使う 6 つだけ(`<field>:<value>` を返す)
const fakePresenters = Object.fromEntries(
  ["status", "role", "name", "providerType", "email", "createdAt"].map((field) => [
    field,
    ({ value }: { value: unknown }) => `${field}:${String(value)}`,
  ]),
);
mock.module("@/features/core/user/presenters", { defaultExport: fakePresenters });

let createGeneralUserListColumns: typeof import("./columns").createGeneralUserListColumns;
let renderToStaticMarkup: typeof import("react-dom/server").renderToStaticMarkup;
before(async () => {
  ({ createGeneralUserListColumns } = await import("./columns"));
  ({ renderToStaticMarkup } = await import("react-dom/server"));
});

const alice = { id: "u1", status: "active", role: "user", name: "アリス", adminMemo: "メモ1" } as unknown as User;
const calls: string[] = [];
const base: GeneralUserListColumnOptions = {
  editBasePath: "/admin/users/general",
  canAdjustWallet: false,
  canManage: false,
  canMemo: false,
  isDeleting: false,
  onAdjust: (u) => calls.push(`adjust:${u.id}`),
  onManage: (u) => calls.push(`manage:${u.id}`),
  onDelete: (u) => calls.push(`delete:${u.id}`),
};
const headers = (options: GeneralUserListColumnOptions) => createGeneralUserListColumns(options).map((c) => c.header);
const actionCell = (options: GeneralUserListColumnOptions) => {
  const columns = createGeneralUserListColumns(options);
  return columns[columns.length - 1].render(alice) as ReactElement;
};

test("列の並び: メモなし = 6 列 + 操作", () => {
  assert.deepEqual(headers(base), ["ステータス", "ロール", "表示名", "認証方法", "メールアドレス", "登録日", "操作"]);
});

test("列の並び: メモあり = 登録日の後・操作の前にメモ", () => {
  assert.deepEqual(headers({ ...base, canMemo: true }), [
    "ステータス", "ロール", "表示名", "認証方法", "メールアドレス", "登録日", "メモ", "操作",
  ]);
});

test("セル: 上流の presenters で描く", () => {
  const columns = createGeneralUserListColumns(base);
  assert.equal(columns[0].render(alice), "status:active");
  assert.equal(columns[2].render(alice), "name:アリス");
});

test("操作のセル: 既定 = 削除 + 編集(飛び先は editBasePath/<id>/edit)", () => {
  const html = renderToStaticMarkup(actionCell(base));
  assert.match(html, /data-variant="destructive">削除</);
  assert.doesNotMatch(html, /ポイント操作|管理/);
  assert.match(html, /href="\/admin\/users\/general\/u1\/edit"/);
});

test("操作のセル: ポイント操作あり・管理あり = 削除は出ない", () => {
  const html = renderToStaticMarkup(actionCell({ ...base, canAdjustWallet: true, canManage: true }));
  assert.match(html, /ポイント操作/);
  assert.match(html, /data-variant="primary">管理</);
  assert.doesNotMatch(html, /削除/);
});

test("操作のセル: 削除の処理中 = 止めて「削除中...」", () => {
  const html = renderToStaticMarkup(actionCell({ ...base, isDeleting: true }));
  assert.match(html, /disabled="">削除中\.\.\.</);
});

test("押下: 各ボタンが対応する handler を対象のユーザーで呼ぶ", () => {
  calls.length = 0;
  const cell = actionCell({ ...base, canAdjustWallet: true });
  const buttons = (cell.props as { children: ReactElement[] }).children.filter(Boolean) as ReactElement<{ onClick?: () => void }>[];
  buttons.forEach((b) => b.props.onClick?.());
  const manageCell = actionCell({ ...base, canManage: true });
  ((manageCell.props as { children: ReactElement<{ onClick?: () => void }>[] }).children[1]).props.onClick?.();
  assert.deepEqual(calls, ["adjust:u1", "delete:u1", "manage:u1"]);
});
