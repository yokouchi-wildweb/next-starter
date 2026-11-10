// src/features/core/user/mypageMenu/upstreamMenu.test.ts
// 上流のマイページのメニュー(items/ の生成の一覧)を組み立て器に通した形の回帰: 4 枚のカードの並び・文言・住所・見た目
// 実行: pnpm test src/features/core/user

import assert from "node:assert/strict";
import { test } from "node:test";

import { EllipsisIcon, GiftIcon, LogOutIcon, UserCircleIcon } from "lucide-react";

import { mypageMenu } from "@/features/core/user/extensions/mypageMenu";

import { buildMypageMenu } from "./buildMypageMenu";

const view = (pending: boolean) =>
  buildMypageMenu({ items: mypageMenu, actions: { logout: { run: () => {}, pending } } }).rows.map((row) => ({
    key: row.key,
    kind: row.kind,
    icon: row.icon,
    title: row.title,
    description: row.description,
    variant: row.variant,
    href: row.kind === "link" ? row.href : undefined,
    showChevron: row.kind === "link" ? row.showChevron : undefined,
    disabled: row.kind === "action" ? row.disabled : undefined,
  }));

test("上流の 4 枚: 招待・アカウント・ログアウト・その他の順と文言", () => {
  assert.deepEqual(view(false), [
    { key: "invite", kind: "link", icon: GiftIcon, title: "招待コードを取得", description: "お友だちを招待して特典を獲得", variant: undefined, href: "/mypage/invite", showChevron: true, disabled: undefined },
    { key: "account", kind: "link", icon: UserCircleIcon, title: "アカウント基本情報", description: "ユーザー名、メールアドレスを確認・編集", variant: undefined, href: "/mypage/account", showChevron: true, disabled: undefined },
    { key: "logout", kind: "action", icon: LogOutIcon, title: "ログアウト", description: "このアカウントからログアウト", variant: undefined, href: undefined, showChevron: undefined, disabled: false },
    { key: "other", kind: "link", icon: EllipsisIcon, title: "その他の操作", description: "アカウントに関するその他の操作", variant: "muted", href: "/mypage/other", showChevron: true, disabled: undefined },
  ]);
});

test("ログアウト中: 題名が「ログアウト中...」になり押せない", () => {
  const row = view(true).find((r) => r.key === "logout");
  assert.equal(row?.title, "ログアウト中...");
  assert.equal(row?.disabled, true);
});
