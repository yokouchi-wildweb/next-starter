// lib/toast/redirect/cookie.ts

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
    let decoded = decodeURIComponent(rawValue);

    if (decoded.startsWith("\"") && decoded.endsWith("\"")) {
      decoded = decoded.slice(1, -1);
    }
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

  const cookies = document.cookie?.split(";") ?? [];

  for (const cookie of cookies) {
    const trimmed = cookie.trim();

    if (trimmed.startsWith(`${REDIRECT_TOAST_COOKIE_NAME}=`)) {
      return trimmed.slice(REDIRECT_TOAST_COOKIE_NAME.length + 1) || null;
    }
  }

  return null;
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
