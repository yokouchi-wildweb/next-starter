// src/lib/redirectToast/constants/cookie.ts

import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const REDIRECT_TOAST_COOKIE_NAME = "redirect-toast";

export const REDIRECT_TOAST_COOKIE_BASE_OPTIONS: Pick<
  ResponseCookie,
  "path" | "sameSite" | "httpOnly" | "secure"
> = {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
};

export const REDIRECT_TOAST_DEFAULT_MAX_AGE_SECONDS = 60;
