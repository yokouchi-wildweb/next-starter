"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { REDIRECT_TOAST_COOKIE_NAME } from "./constants";
import type { RedirectToastPayload } from "./types";

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

      if (payload.type === "success" && payload.message) {
        toast.success(payload.message);
      }
    } catch (error) {
      console.error("Failed to render redirect toast", error);
    } finally {
      clearCookie(REDIRECT_TOAST_COOKIE_NAME);
    }
  }, []);

  return null;
};

