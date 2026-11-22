// src/proxies/redirect.ts
// 骨組みの handler(段 redirect、門番の後): 点 proxyRedirects の規則(<ドメイン>/plugs/proxyRedirects/<名前>.ts、閉じたドメインの規則は門番が外す)に
// 当たった住所を転送する。規則の利用者の条件は ctx.user()(当たったときだけ解く)

import { NextResponse } from "next/server";

import { gate } from "@/featureGate";
import { setRedirectToastCookie } from "@/lib/toast";

import { proxyRedirects } from "./extensions/proxyRedirects";
import type { ProxyHandler, ProxyUser, RedirectRule } from "./types";

/**
 * 規則の組を 1 本にし、同じ sourcePath が 2 つの規則に出たら止める(どちらが効くかが並びで黙って決まらないように)
 */
export function flattenRedirectRules(groups: readonly (readonly RedirectRule[])[]): RedirectRule[] {
  const rules = groups.flat();
  const seen = new Map<string, number>();
  rules.forEach((rule, index) => {
    for (const path of rule.sourcePaths) {
      if (seen.has(path)) {
        throw new Error(`[proxies] 転送の規則で sourcePath "${path}" が重複しています(<ドメイン>/plugs/proxyRedirects/ の項目を確かめてください)`);
      }
      seen.set(path, index);
    }
  });
  return rules;
}

const redirectRules = flattenRedirectRules(gate.plugs(proxyRedirects).map((entry) => entry.plug));

const findRedirectRule = (pathname: string) => redirectRules.find((rule) => rule.sourcePaths.includes(pathname));

const shouldRedirectForRule = (
  rule: RedirectRule,
  sessionUser: ProxyUser | null,
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
