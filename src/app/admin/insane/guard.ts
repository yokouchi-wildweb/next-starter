// src/app/admin/insane/guard.ts
//
// 危険操作の範囲(admin ロールだけ)。admin ロールの利用者が 1 人もいない環境では初期セットアップへ誘導する。

import "server-only";

import { extend as extendRoot } from "@/app/guard";

export const { guard, createLoader, extend } = extendRoot({
  access: { roles: ["admin"] },
  redirectTo: "/admin/login",
  forbiddenRedirectTo: "/admin/login",
  returnBack: true,
  setupRedirectTo: "/admin/setup",
});
