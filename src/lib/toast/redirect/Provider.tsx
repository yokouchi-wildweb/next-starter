// lib/toast/redirect/Provider.tsx

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useToast } from "../useToast";
import { clearRedirectToastCookie, readRedirectToastCookie } from "./cookie";
import type { RedirectToastVariant } from "./types";
import type { ToastVariant } from "../types";

const variantMap: Record<RedirectToastVariant, ToastVariant> = {
  success: "success",
  info: "info",
  warning: "warning",
  error: "error",
};

export const RedirectToastProvider = () => {
  const pathname = usePathname();
  const { showToast } = useToast();

  useEffect(() => {
    const payload = readRedirectToastCookie();

    if (!payload) {
      return;
    }

    const variant = variantMap[payload.variant] ?? "info";
    showToast(payload.message, variant);
    clearRedirectToastCookie();
  }, [pathname, showToast]);

  return null;
};
