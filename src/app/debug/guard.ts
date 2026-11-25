// src/app/debug/guard.ts
//
// デバッグ領域(/debug/**)。管理者カテゴリ + debugger ロール。debugger は user カテゴリのロールのため、
// 行き先は /admin/login ではなく /login。debugger はメンテナンスのバイパス対象(設定ドメインの config の maintenance.bypassRoles)。
// ログイン済みで通らない人(会員など)は notFound(ログインの画面へは未ログインの人だけ、D116)。

import "server-only";

import { extend as extendRoot } from "@/app/guard";

export const { Guard, createLoader, guardMetadata, extend } = extendRoot({
  access: { roleCategories: ["admin"], roles: ["debugger"] },
  redirectTo: "/login",
  returnBack: true,
});
