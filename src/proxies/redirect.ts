import { NextResponse } from "next/server";

import { userConfig } from "@/features/user/config";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { setRedirectToastCookie } from "@/lib/toast";

import { redirects } from "./extensions/redirects";
import type { ProxyHandler, RedirectRule } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// 内部リダイレクトルール（システム定義）
// fork の規則（受け口 src/proxies/redirects/<名前>.ts）とは分離して管理
// ─────────────────────────────────────────────────────────────────────────────

/**
 * サインアップモードに応じたリダイレクトルール
 * - earlyRegistration: /signup → /entry
 * - normal: /entry → /signup
 */
const getSignupModeRules = (): RedirectRule[] => {
  const mode = userConfig.signupMode;

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

/**
 * 受け口の規則を 1 本にし、同じ sourcePath が 2 つの規則に出たら止める(どちらが効くかが並びで黙って決まらないように)
 */
export function flattenRedirectRules(groups: readonly (readonly RedirectRule[])[]): RedirectRule[] {
  const rules = groups.flat();
  const seen = new Map<string, number>();
  rules.forEach((rule, index) => {
    for (const path of rule.sourcePaths) {
      if (seen.has(path)) {
        throw new Error(`[proxies] 転送の規則で sourcePath "${path}" が重複しています(src/proxies/redirects/ の項目を確かめてください)`);
      }
      seen.set(path, index);
    }
  });
  return rules;
}

const configuredRedirectRules = flattenRedirectRules(redirects);

const findRedirectRule = (pathname: string) => {
  const allRules = [...getInternalRedirectRules(), ...configuredRedirectRules];
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
