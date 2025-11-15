"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { RedirectToastDefinition } from "@/lib/redirectToast/entities/schema";
import { REDIRECT_TOAST_COOKIE_NAME } from "@/lib/redirectToast/constants/cookie";

type RedirectToastClientProps = {
  toast: RedirectToastDefinition | null;
};

const clearRedirectToastCookie = () => {
  document.cookie = `${REDIRECT_TOAST_COOKIE_NAME}=; path=/; max-age=0; expires=${new Date(0).toUTCString()}`;
};

const displayRedirectToast = ({ variant, title, description, duration }: RedirectToastDefinition) => {
  const options = {
    ...(description ? { description } : {}),
    ...(typeof duration === "number" ? { duration } : {}),
  };

  switch (variant) {
    case "success":
      toast.success(title, options);
      break;
    case "info":
      toast.info(title, options);
      break;
    case "warning":
      toast.warning(title, options);
      break;
    case "error":
      toast.error(title, options);
      break;
    case "message":
    default:
      toast.message(title, options);
      break;
  }
};

export function RedirectToastClient({ toast: initialToast }: RedirectToastClientProps) {
  const hasDisplayedRef = useRef(false);

  useEffect(() => {
    if (!initialToast) {
      return;
    }

    if (hasDisplayedRef.current) {
      return;
    }

    hasDisplayedRef.current = true;

    displayRedirectToast(initialToast);
    clearRedirectToastCookie();
  }, [initialToast]);

  return null;
}
