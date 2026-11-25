// src/app/admin/(protected)/users/guard.ts
//
// ユーザー管理の範囲。管理画面の範囲(親)に重ねて admin ロールだけ(editor 等は管理画面の先頭へ戻す)。
// 未ログインの人は親の範囲が /admin/login へ先に送るので、この段は redirectTo を持たない(forbiddenRedirectTo はログインと別の値、D116)。

import "server-only";

import { extend as extendAdmin } from "../guard";

export const { Guard, createLoader, guardMetadata, extend } = extendAdmin({
  access: { roles: ["admin"] },
  forbiddenRedirectTo: "/admin",
});
