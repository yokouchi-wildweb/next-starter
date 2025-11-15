// src/lib/redirectToast/services/server/redirectToastCookie.ts

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import {
  REDIRECT_TOAST_COOKIE_BASE_OPTIONS,
  REDIRECT_TOAST_COOKIE_NAME,
  REDIRECT_TOAST_DEFAULT_MAX_AGE_SECONDS,
} from "@/lib/redirectToast/constants/cookie";
import { RedirectToastSchema, type RedirectToastDefinition } from "@/lib/redirectToast/entities/schema";

const createExpiresAt = (maxAgeSeconds: number): Date => new Date(Date.now() + maxAgeSeconds * 1000);

type CookieReader = {
  get(name: string): { value?: string | null } | undefined;
};

type QueueRedirectToastParams = {
  cookies: ResponseCookies;
  toast: RedirectToastDefinition;
  maxAgeSeconds?: number;
};

type ClearRedirectToastParams = {
  cookies: ResponseCookies;
};

export function queueRedirectToast({
  cookies,
  toast,
  maxAgeSeconds = REDIRECT_TOAST_DEFAULT_MAX_AGE_SECONDS,
}: QueueRedirectToastParams): void {
  const payload = RedirectToastSchema.parse(toast);
  const serializedPayload = JSON.stringify(payload);

  const safeMaxAge = Math.max(1, Math.floor(maxAgeSeconds));

  cookies.set(REDIRECT_TOAST_COOKIE_NAME, serializedPayload, {
    ...REDIRECT_TOAST_COOKIE_BASE_OPTIONS,
    maxAge: safeMaxAge,
    expires: createExpiresAt(safeMaxAge),
  });
}

export function readRedirectToast(cookieStore: CookieReader): RedirectToastDefinition | null {
  const cookie = cookieStore.get(REDIRECT_TOAST_COOKIE_NAME);
  const value = cookie?.value;

  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const result = RedirectToastSchema.safeParse(parsed);

    if (!result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

export function clearRedirectToast({ cookies }: ClearRedirectToastParams): void {
  cookies.set(REDIRECT_TOAST_COOKIE_NAME, "", {
    ...REDIRECT_TOAST_COOKIE_BASE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
}
