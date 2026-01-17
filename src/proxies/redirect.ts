import { NextResponse } from "next/server";

import { redirectRules, type RedirectRule } from "@/config/app/redirect.config";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { resolveSessionUser } from "@/features/core/auth/services/server/session/token";
import { setRedirectToastCookie } from "@/lib/toast";
import { parseSessionCookie } from "@/lib/jwt";

import type { ProxyHandler } from "./types";

const findRedirectRule = (pathname: string) => {
  return redirectRules.find((rule) => rule.sourcePaths.includes(pathname));
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

export const redirectProxy: ProxyHandler = async (request) => {
  const pathname = request.nextUrl.pathname;
  const rule = findRedirectRule(pathname);

  if (!rule) {
    return;
  }

  const token = parseSessionCookie(request.cookies);

  const sessionUser = token ? await resolveSessionUser(token) : null;

  if (!shouldRedirectForRule(rule, sessionUser)) {
    return;
  }

  const response = NextResponse.redirect(new URL(rule.destination, request.url));

  if (rule.toast) {
    setRedirectToastCookie(response, rule.toast);
  }

  return response;
};
