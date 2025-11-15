"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { REDIRECT_TOAST_COOKIE_NAME } from "./constants";
import type { RedirectToastPayload, RedirectToastType } from "./types";

const setRedirectToast = (payload: RedirectToastPayload) => {
  const cookieStore = cookies();
  cookieStore.set(REDIRECT_TOAST_COOKIE_NAME, encodeURIComponent(JSON.stringify(payload)), {
    httpOnly: false,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
  });
};

const withToast = (payload: RedirectToastPayload, url: string) => {
  setRedirectToast(payload);
  redirect(url);
};

const createRedirectWithToast = (type: RedirectToastType) => (url: string, message: string) =>
  withToast(
    {
      type,
      message,
    },
    url,
  );

export const redirectWithToast = {
  success: createRedirectWithToast("success"),
  error: createRedirectWithToast("error"),
  warning: createRedirectWithToast("warning"),
  info: createRedirectWithToast("info"),
  default: createRedirectWithToast("default"),
};
