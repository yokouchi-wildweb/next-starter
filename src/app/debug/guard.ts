// src/app/debug/guard.ts
//
// デバッグ領域(/debug/**)。管理者カテゴリ + debugger ロール。debugger は user カテゴリのロールのため、
// 行き先は /admin/login ではなく /login。debugger はメンテナンスのバイパス対象(maintenance.config.ts の bypassRoles)。

import "server-only";

import { extend as extendRoot } from "@/app/guard";

export const { guard, createLoader, extend } = extendRoot({
  access: { roleCategories: ["admin"], roles: ["debugger"] },
  redirectTo: "/login",
  forbiddenRedirectTo: "/login",
  returnBack: true,
});
