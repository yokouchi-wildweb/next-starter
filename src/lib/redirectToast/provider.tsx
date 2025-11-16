"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { clearRedirectToastCookie, readRedirectToastCookie } from "./cookie";
import type { RedirectToastPayload, RedirectToastVariant } from "./types";

const variantToHandler: Record<RedirectToastVariant, (message: string) => void> = {
  success: toast.success,
  info: toast.info,
  warning: toast.warning,
  error: toast.error,
};

const showToast = ({ message, variant }: RedirectToastPayload) => {
  const handler = variantToHandler[variant];

  if (handler) {
    handler(message);
    return;
  }

  toast(message);
};

export const RedirectToastProvider = () => {
  useEffect(() => {
    const payload = readRedirectToastCookie();

    if (!payload) {
      return;
    }

    showToast(payload);
    clearRedirectToastCookie();
  }, []);

  return null;
};
