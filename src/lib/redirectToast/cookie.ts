import { REDIRECT_TOAST_COOKIE_NAME } from "./constants";
import type { RedirectToastPayload, RedirectToastVariant } from "./types";

const REDIRECT_TOAST_VARIANTS: RedirectToastVariant[] = ["success", "info", "warning", "error"];

const isRedirectToastVariant = (value: string): value is RedirectToastVariant => {
  return REDIRECT_TOAST_VARIANTS.includes(value as RedirectToastVariant);
};

const parseCookieValue = (rawValue: string | undefined | null): RedirectToastPayload | null => {
  if (!rawValue) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(rawValue);
    const parsed = JSON.parse(decoded) as RedirectToastPayload;

    if (typeof parsed.message !== "string" || !isRedirectToastVariant(parsed.variant)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const getCookieValue = (): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  return (
    document.cookie
      ?.split("; ")
      .find((cookie) => cookie.startsWith(`${REDIRECT_TOAST_COOKIE_NAME}=`))
      ?.slice(REDIRECT_TOAST_COOKIE_NAME.length + 1) ?? null
  );
};

export const readRedirectToastCookie = (): RedirectToastPayload | null => {
  return parseCookieValue(getCookieValue());
};

export const clearRedirectToastCookie = (): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${REDIRECT_TOAST_COOKIE_NAME}=; path=/; max-age=0`;
};
