// src/features/core/user/mypageMenu/buildMypageMenu.test.ts
// 組み立て器の回帰: hidden の除去・並び(order → key)・操作の結び(処理中の題名と無効)・結び先の無い操作の除去・リンクの写し
// 実行: pnpm test src/features/core/user

import assert from "node:assert/strict";
import { test } from "node:test";

import { GiftIcon } from "lucide-react";

import type { MypageMenuItem } from "@/features/core/user/types";

import { buildMypageMenu } from "./buildMypageMenu";

const keyed = (list: MypageMenuItem[]): Record<string, MypageMenuItem> => Object.fromEntries(list.map((x) => [x.key, x]));

const link = (key: string, order: number, extra: Partial<MypageMenuItem> = {}): MypageMenuItem =>
  ({ key, order, title: key, description: `${key} の説明`, icon: GiftIcon, href: `/mypage/${key}`, ...extra }) as MypageMenuItem;

const logout: MypageMenuItem = {
  key: "logout",
  order: 30,
  title: "ログアウト",
  pendingTitle: "ログアウト中...",
  description: "d",
  icon: GiftIcon,
  action: "logout",
};

test("hidden の項目は描かず、理由を残す", () => {
  const built = buildMypageMenu({ items: keyed([link("a", 10), link("b", 20, { hidden: true })]), actions: {} });
  assert.deepEqual(built.rows.map((r) => r.key), ["a"]);
  assert.deepEqual(built.hidden, [{ key: "b", reason: "item-hidden" }]);
});

test("order 昇順、同じ値は key 順", () => {
  const built = buildMypageMenu({ items: keyed([link("c", 20), link("b", 10), link("a", 20)]), actions: {} });
  assert.deepEqual(built.rows.map((r) => r.key), ["b", "a", "c"]);
});

test("リンクの項目は href・showChevron・variant をそのまま写す", () => {
  const built = buildMypageMenu({ items: keyed([link("a", 10, { showChevron: true, variant: "muted" })]), actions: {} });
  const row = built.rows[0];
  assert.equal(row.kind, "link");
  if (row.kind !== "link") return;
  assert.equal(row.href, "/mypage/a");
  assert.equal(row.showChevron, true);
  assert.equal(row.variant, "muted");
  assert.equal(row.title, "a");
});

test("操作の項目は結び先に結ぶ(押すと run、処理中でなければ題名のまま)", () => {
  let calls = 0;
  const built = buildMypageMenu({ items: keyed([logout]), actions: { logout: { run: () => void calls++, pending: false } } });
  const row = built.rows[0];
  assert.equal(row.kind, "action");
  if (row.kind !== "action") return;
  assert.equal(row.title, "ログアウト");
  assert.equal(row.disabled, false);
  row.onClick();
  assert.equal(calls, 1);
});

test("処理中は pendingTitle と disabled(pendingTitle の無い項目は題名のまま)", () => {
  const pending = { run: () => {}, pending: true };
  const withPending = buildMypageMenu({ items: keyed([logout]), actions: { logout: pending } }).rows[0];
  assert.equal(withPending.title, "ログアウト中...");
  assert.equal(withPending.kind === "action" && withPending.disabled, true);
  const { pendingTitle: _omit, ...plain } = logout as Extract<MypageMenuItem, { action: string }>;
  const without = buildMypageMenu({ items: keyed([plain]), actions: { logout: pending } }).rows[0];
  assert.equal(without.title, "ログアウト");
});

test("結び先の無い操作は描かず、理由を残す", () => {
  const built = buildMypageMenu({ items: keyed([logout, link("a", 10)]), actions: {} });
  assert.deepEqual(built.rows.map((r) => r.key), ["a"]);
  assert.deepEqual(built.hidden, [{ key: "logout", reason: "unknown-action" }]);
});
