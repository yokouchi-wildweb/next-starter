"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { REDIRECT_TOAST_COOKIE_NAME, REDIRECT_TOAST_SEARCH_PARAM_NAME } from "./constants";
import type { RedirectToastPayload, RedirectToastType } from "./types";

const TOAST_RENDERERS: Record<RedirectToastType, (message: string) => void> = {
  success: (message: string) => {
    toast.success(message);
  },
  error: (message: string) => {
    toast.error(message);
  },
  warning: (message: string) => {
    toast.warning(message);
  },
  info: (message: string) => {
    toast.info(message);
  },
  default: (message: string) => {
    toast(message);
  },
};

const getCookieValue = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!target) return null;

  const [, value] = target.split("=");
  return value ?? null;
};

const clearCookie = (name: string) => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
};

const resolveEncodedPayload = (): string | null => {
  const encodedFromCookie = getCookieValue(REDIRECT_TOAST_COOKIE_NAME);

  if (encodedFromCookie) {
    clearCookie(REDIRECT_TOAST_COOKIE_NAME);
    return encodedFromCookie;
  }

  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const encodedFromQuery = url.searchParams.get(REDIRECT_TOAST_SEARCH_PARAM_NAME);

  if (!encodedFromQuery) {
    return null;
  }

  url.searchParams.delete(REDIRECT_TOAST_SEARCH_PARAM_NAME);
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
  window.history.replaceState(null, "", nextUrl);

  return encodedFromQuery;
};

export const RedirectToastProvider = () => {
  useEffect(() => {
    const encodedPayload = resolveEncodedPayload();

    if (!encodedPayload) {
      return;
    }

    try {
      const payload: RedirectToastPayload = JSON.parse(decodeURIComponent(encodedPayload));

      if (!payload.message) {
        return;
      }

      const showToast = TOAST_RENDERERS[payload.type] ?? TOAST_RENDERERS.default;
      showToast(payload.message);
    } catch (error) {
      console.error("Failed to render redirect toast", error);
    }
  });

  return null;
};

