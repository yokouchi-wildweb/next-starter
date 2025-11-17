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

    if (!payload) {
      return;
    }

    showToast(payload);
    clearRedirectToastCookie();
  }, [pathname]);

  return null;
};
