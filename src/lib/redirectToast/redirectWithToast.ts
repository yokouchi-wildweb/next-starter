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

const redirectWithToastInternal = (payload: RedirectToastPayload, url: string) => {
  setRedirectToast(payload);
  redirect(url);
};

export async function redirectWithToast(payload: RedirectToastPayload, url: string): Promise<never> {
  redirectWithToastInternal(payload, url);
}

type RedirectWithToastHandler = (url: string, message: string) => Promise<never>;

const createRedirectWithToast = (type: RedirectToastType): RedirectWithToastHandler =>
  async (url, message) =>
    redirectWithToast(
      {
        type,
        message,
      },
      url,
    );

export const redirectWithToastSuccess = createRedirectWithToast("success");
export const redirectWithToastError = createRedirectWithToast("error");
export const redirectWithToastWarning = createRedirectWithToast("warning");
export const redirectWithToastInfo = createRedirectWithToast("info");
export const redirectWithToastDefault = createRedirectWithToast("default");
