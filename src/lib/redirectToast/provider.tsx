"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
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
  // デバッグ用にアラートも出す
  alert(`redirect toast: ${message}`);
  const handler = variantToHandler[variant];

  if (handler) {
    handler(message);
    return;
  }

  toast(message);
};

export const RedirectToastProvider = () => {
  const pathname = usePathname();

  useEffect(() => {
    const payload = readRedirectToastCookie();
    console.log("RedirectToastProvider payload", payload);

    if (!payload) {
      return;
    }

    showToast(payload);
    // デバッグのためクッキー削除は一時的に無効化する
    // clearRedirectToastCookie();
  }, [pathname]);

  return null;
};
