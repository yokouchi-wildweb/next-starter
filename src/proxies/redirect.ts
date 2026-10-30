import { NextResponse } from "next/server";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { redirectRules, type RedirectRule } from "@/config/app/redirect.config";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { setRedirectToastCookie } from "@/lib/toast";

import type { ProxyHandler } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// 内部リダイレクトルール（システム定義）
// ユーザー設定ファイル（redirect.config.ts）とは分離して管理
// ─────────────────────────────────────────────────────────────────────────────

/**
 * サインアップモードに応じたリダイレクトルール
 * - earlyRegistration: /signup → /entry
 * - normal: /entry → /signup
 */
const getSignupModeRules = (): RedirectRule[] => {
  const { mode } = APP_FEATURES.auth.signup;

  if (mode === "earlyRegistration") {
    return [{ sourcePaths: ["/signup"], destination: "/entry", authedOnly: false }];
  }
  return [{ sourcePaths: ["/entry"], destination: "/signup", authedOnly: false }];
};

/**
 * 内部リダイレクトルールを取得
 * 新しいルールを追加する場合はここに追加
 */
const getInternalRedirectRules = (): RedirectRule[] => [
  ...getSignupModeRules(),
];

// ─────────────────────────────────────────────────────────────────────────────

const findRedirectRule = (pathname: string) => {
  const allRules = [...getInternalRedirectRules(), ...redirectRules];
  return allRules.find((rule) => rule.sourcePaths.includes(pathname));
};

const shouldRedirectForRule = (
  rule: RedirectRule,
  sessionUser: SessionUser | null,
): boolean => {
  const guestOnly = rule.guestOnly ?? false;
  const authedOnly = rule.authedOnly ?? true;

  if (guestOnly) {
    if (!sessionUser) {
      return false;
    }
  } else if (authedOnly && !sessionUser) {
    return false;
  }

  if (!sessionUser) {
    if ((rule.allowRoles?.length ?? 0) > 0 || (rule.excludeRoles?.length ?? 0) > 0) {
      return false;
    }
    return true;
  }

  if (rule.allowRoles && !rule.allowRoles.includes(sessionUser.role)) {
    return false;
  }

  if (rule.excludeRoles && rule.excludeRoles.includes(sessionUser.role)) {
    return false;
  }

  return true;
};

export const redirectProxy: ProxyHandler = async (request, ctx) => {
  const pathname = request.nextUrl.pathname;
  const rule = findRedirectRule(pathname);

  if (!rule) {
    return;
  }

  // 利用者は規則に当たったときだけ解決する(ctx.user: DB 同期、利用可能な status だけ)
  if (!shouldRedirectForRule(rule, await ctx.user())) {
    return;
  }

  const response = NextResponse.redirect(new URL(rule.destination, request.url));

  if (rule.toast) {
    setRedirectToastCookie(response, rule.toast);
  }

  return response;
};
