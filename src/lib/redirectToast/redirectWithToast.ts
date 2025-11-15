"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { REDIRECT_TOAST_COOKIE_NAME } from "./constants";
import type { RedirectToastPayload } from "./types";

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

export const redirectWithToast = {
  success: (url: string, message: string) =>
    withToast(
      {
        type: "success",
        message,
      },
      url,
    ),
};
