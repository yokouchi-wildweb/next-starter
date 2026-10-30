// src/app/admin/(protected)/users/guard.ts
//
// ユーザー管理の範囲。管理画面の範囲(親)に重ねて admin ロールだけ(editor 等は管理画面の先頭へ戻す)。

import "server-only";

import { extend as extendAdmin } from "../guard";

export const { guard, createLoader, extend } = extendAdmin({
  access: { roles: ["admin"] },
  redirectTo: "/admin",
  forbiddenRedirectTo: "/admin",
});
