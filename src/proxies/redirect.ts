import { NextResponse } from "next/server";

import { redirectRules } from "@/config/redirect.config";
import { resolveSessionUser } from "@/features/auth/services/server/session/token";
import { setRedirectToastCookie } from "@/lib/redirectToast/server";
import { parseSessionCookie } from "@/lib/jwt";

import type { ProxyHandler } from "./types";

const findRedirectRule = (pathname: string) => {
  return redirectRules.find((rule) => rule.sourcePaths.includes(pathname));
};

export const redirectProxy: ProxyHandler = async (request) => {
  const pathname = request.nextUrl.pathname;
  const rule = findRedirectRule(pathname);

  if (!rule) {
    return;
  }

  const token = parseSessionCookie(request.cookies);

  if (!token) {
    return;
  }

  const sessionUser = await resolveSessionUser(token);

  if (!sessionUser) {
    return;
  }

  const response = NextResponse.redirect(new URL(rule.destination, request.url));

  setRedirectToastCookie(response, rule.toast);

  return response;
};
