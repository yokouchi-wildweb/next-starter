"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { REDIRECT_TOAST_COOKIE_NAME } from "./constants";
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
  document.cookie = `${name}=; path=/; max-age=0`;
};

export const RedirectToastProvider = () => {
  useEffect(() => {
    const encodedPayload = getCookieValue(REDIRECT_TOAST_COOKIE_NAME);
    if (!encodedPayload) return;

    try {
      const payload: RedirectToastPayload = JSON.parse(decodeURIComponent(encodedPayload));

      if (!payload.message) {
        return;
      }

      const showToast = TOAST_RENDERERS[payload.type] ?? TOAST_RENDERERS.default;
      showToast(payload.message);
    } catch (error) {
      console.error("Failed to render redirect toast", error);
    } finally {
      clearCookie(REDIRECT_TOAST_COOKIE_NAME);
    }
  }, []);

  return null;
};

