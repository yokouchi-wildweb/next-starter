"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useAppToast } from "@/hooks/useAppToast";
import { clearRedirectToastCookie, readRedirectToastCookie } from "./cookie";
import type { RedirectToastVariant } from "./types";
import type { AppToastVariant } from "@/stores/appToast";

const variantMap: Record<RedirectToastVariant, AppToastVariant> = {
  success: "success",
  info: "info",
  warning: "warning",
  error: "error",
};

export const RedirectToastProvider = () => {
  const pathname = usePathname();
  const { showAppToast } = useAppToast();

  useEffect(() => {
    const payload = readRedirectToastCookie();

    if (!payload) {
      return;
    }

    const variant = variantMap[payload.variant] ?? "info";
    showAppToast(payload.message, variant);
    clearRedirectToastCookie();
  }, [pathname, showAppToast]);

  return null;
};
