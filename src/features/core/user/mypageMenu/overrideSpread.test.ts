// src/features/core/user/mypageMenu/overrideSpread.test.ts
// 上書きの重ね方の回帰(型と実行): 型注釈つきの `const override: MypageMenuItemOverride` を、
// 生成の一覧(extensions/mypageMenu.ts)と同じ { ...項目, ...上書き } の形でリンク・操作の両方の項目に重ねる。
// 型が合わなければ tsc(pnpm typecheck)がこのファイルで止まる。items/ に上書きのファイルは置かない(上流は出荷しない)
// 実行: pnpm test src/features/core/user

import assert from "node:assert/strict";
import { test } from "node:test";

import { CoinsIcon } from "lucide-react";

import type { MypageMenuItem, MypageMenuItemOverride } from "@/features/core/user/types";

import { buildMypageMenu } from "./buildMypageMenu";
import { item as account } from "./items/account";
import { item as logout } from "./items/logout";

// fork が書く形そのまま(注釈つき)。全部の鍵を使う
const accountOverride: MypageMenuItemOverride = {
  order: 50,
  title: "アカウント",
  description: "説明",
  icon: CoinsIcon,
  variant: "muted",
  pendingTitle: "使われない",
};
const logoutOverride: MypageMenuItemOverride = { order: 5, pendingTitle: "サインアウト中..." };

// 生成器が書く形(scripts/structure/extensions/extensions.mjs: `{ ...<項目>, ...<項目>_override }`)
const list: MypageMenuItem[] = [
  { ...account, ...accountOverride },
  { ...logout, ...logoutOverride },
];
const items: Record<string, MypageMenuItem> = Object.fromEntries(list.map((item) => [item.key, item]));

test("注釈つきの上書きをリンクと操作の項目に重ねられ、組み立て器が値を使う", () => {
  const rows = buildMypageMenu({ items, actions: { logout: { run: () => {}, pending: true } } }).rows;
  assert.deepEqual(rows.map((row) => row.key), ["logout", "account"]);
  const [action, link] = rows;
  assert.equal(action.kind, "action");
  assert.equal(action.title, "サインアウト中...");
  assert.equal(link.kind, "link");
  assert.equal(link.title, "アカウント");
  assert.equal(link.icon, CoinsIcon);
  assert.equal(link.variant, "muted");
  if (link.kind === "link") assert.equal(link.href, "/mypage/account");
});

test("hidden の上書きは項目を描かない", () => {
  const hidden: MypageMenuItemOverride = { hidden: true };
  const built = buildMypageMenu({ items: { account: { ...account, ...hidden } }, actions: {} });
  assert.deepEqual(built.rows, []);
  assert.deepEqual(built.hidden, [{ key: "account", reason: "item-hidden" }]);
});
