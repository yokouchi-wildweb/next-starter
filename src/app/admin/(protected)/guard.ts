// src/app/admin/(protected)/guard.ts
//
// 管理画面の範囲(管理者カテゴリ)。管理者が 1 人もいない環境では初期セットアップへ誘導する
// (判定は wiring が作り手へ渡す。ここは行き先の値だけ)。

import "server-only";

import { extend as extendRoot } from "@/app/guard";

export const { guard, createLoader, extend } = extendRoot({
  access: { roleCategories: ["admin"] },
  redirectTo: "/admin/login",
  forbiddenRedirectTo: "/admin/login",
  returnBack: true,
  setupRedirectTo: "/admin/setup",
});
