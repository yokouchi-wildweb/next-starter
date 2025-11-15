"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { REDIRECT_TOAST_COOKIE_NAME, REDIRECT_TOAST_SEARCH_PARAM_NAME } from "./constants";
import type { RedirectToastPayload, RedirectToastType } from "./types";

const setRedirectToastCookie = async (payload: RedirectToastPayload) => {
  const cookieStore = await cookies();
  cookieStore.set(REDIRECT_TOAST_COOKIE_NAME, encodeURIComponent(JSON.stringify(payload)), {
    httpOnly: false,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
  });
};

const buildUrlWithRedirectToastParam = (url: string, payload: RedirectToastPayload) => {
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const [base, hash = ""] = url.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  const urlWithParam = `${base}${separator}${REDIRECT_TOAST_SEARCH_PARAM_NAME}=${encodedPayload}`;

  return hash ? `${urlWithParam}#${hash}` : urlWithParam;
};

const redirectWithToastInternal = async (payload: RedirectToastPayload, url: string) => {
  try {
    await setRedirectToastCookie(payload);
    redirect(url);
  } catch (error) {
    redirect(buildUrlWithRedirectToastParam(url, payload));
  }
};

export async function redirectWithToast(payload: RedirectToastPayload, url: string): Promise<never> {
  await redirectWithToastInternal(payload, url);
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
