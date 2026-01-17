// lib/toast/redirect/server.ts

import type { NextResponse } from "next/server";

import { REDIRECT_TOAST_COOKIE_MAX_AGE_SECONDS, REDIRECT_TOAST_COOKIE_NAME } from "./constants";
import type { RedirectToastPayload } from "./types";

export const setRedirectToastCookie = (
  response: NextResponse,
  payload: RedirectToastPayload,
): void => {
  response.cookies.set(REDIRECT_TOAST_COOKIE_NAME, JSON.stringify(payload), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: REDIRECT_TOAST_COOKIE_MAX_AGE_SECONDS,
  });
};
