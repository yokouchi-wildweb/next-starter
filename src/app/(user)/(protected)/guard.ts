// src/app/(user)/(protected)/guard.ts
//
// ログイン必須の利用者の範囲(/mypage/** 等)。利用者・管理者カテゴリで利用可能な status だけを通し、
// 利用できない status は案内の画面へ送る。
// ログイン済みで通らない人(status 別の行き先の無いもの)は notFound(ログインの画面へは未ログインの人だけ、D116)。

import "server-only";

import { extend as extendRoot } from "@/app/guard";

export const { Guard, createLoader, guardMetadata, extend } = extendRoot({
  access: { roleCategories: ["admin", "user"] },
  redirectTo: "/login",
  returnBack: true,
  statusRedirects: {
    inactive: "/reactivate",
    suspended: "/restricted",
    banned: "/restricted",
    security_locked: "/restricted",
    pending: "/logout?redirectTo=/signup",
    withdrawn: "/logout?redirectTo=/signup",
  },
});
