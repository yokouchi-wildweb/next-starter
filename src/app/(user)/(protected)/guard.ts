// src/app/(user)/(protected)/guard.ts
//
// ログイン必須の利用者の範囲(/mypage/** 等)。利用者・管理者カテゴリで利用可能な status だけを通し、
// 利用できない status は案内の画面へ送る。

import "server-only";

import { extend as extendRoot } from "@/app/guard";

export const { guard, createLoader, extend } = extendRoot({
  access: { roleCategories: ["admin", "user"] },
  redirectTo: "/login",
  forbiddenRedirectTo: "/login",
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
