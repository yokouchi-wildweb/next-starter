// src/app/admin/(protected)/guard.ts
//
// 管理画面の範囲(管理者カテゴリ)。管理者が 1 人もいない環境では初期セットアップへ誘導する
// (判定は wiring が作り手へ渡す。ここは行き先の値だけ)。
// ログイン済みの会員が開くと notFound(ログインの画面へは未ログインの人だけ、D116)。

import "server-only";

import { extend as extendRoot } from "@/app/guard";

export const { Guard, createLoader, guardMetadata, extend } = extendRoot({
  access: { roleCategories: ["admin"] },
  redirectTo: "/admin/login",
  returnBack: true,
  setupRedirectTo: "/admin/setup",
});
