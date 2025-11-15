"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { REDIRECT_TOAST_COOKIE_NAME, REDIRECT_TOAST_SEARCH_PARAM_NAME } from "./constants";
import type { RedirectToastPayload, RedirectToastType } from "./types";

const trySetRedirectToastCookie = (payload: RedirectToastPayload) => {
  try {
    const cookieStore = cookies();
    if (typeof cookieStore.set !== "function") {
      return false;
    }

    cookieStore.set(REDIRECT_TOAST_COOKIE_NAME, encodeURIComponent(JSON.stringify(payload)), {
      httpOnly: false,
      maxAge: 60,
      path: "/",
      sameSite: "lax",
    });

    return true;
  } catch (error) {
    return false;
  }
};

const buildUrlWithRedirectToastParam = (url: string, payload: RedirectToastPayload) => {
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const [base, hash = ""] = url.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  const urlWithParam = `${base}${separator}${REDIRECT_TOAST_SEARCH_PARAM_NAME}=${encodedPayload}`;

  return hash ? `${urlWithParam}#${hash}` : urlWithParam;
};

export async function redirectWithToast(payload: RedirectToastPayload, url: string): Promise<never> {
  const hasSetCookie = trySetRedirectToastCookie(payload);
  const destination = hasSetCookie ? url : buildUrlWithRedirectToastParam(url, payload);

  redirect(destination);
}

type RedirectWithToastHandler = (url: string, message: string) => Promise<never>;

const createRedirectWithToast = (type: RedirectToastType): RedirectWithToastHandler => async (url, message) =>
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
