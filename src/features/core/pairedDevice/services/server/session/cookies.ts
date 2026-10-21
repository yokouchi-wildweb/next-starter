// src/features/core/pairedDevice/services/server/session/cookies.ts
//
// 端末トークン・ペアリング承認待ちの Cookie。ユーザーセッションの Cookie とは別名で、互いに干渉しない。

import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";
import { SESSION_COOKIE_BASE_OPTIONS } from "@/features/core/auth/constants/session";

type CookieReader = { get(name: string): { value: string } | undefined };

export const PAIRED_DEVICE_COOKIE_NAME = PAIRED_DEVICE_CONFIG.cookie.name;
export const PAIRED_DEVICE_PENDING_COOKIE_NAME = PAIRED_DEVICE_CONFIG.cookie.pendingPairingName;

const maxAgeSeconds = (expiresAt: Date): number =>
  Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

/** 端末トークンを Cookie に書く（ペアリング成立時・有効期限の延長時） */
export function setPairedDeviceCookie(cookies: ResponseCookies, token: string, expiresAt: Date): void {
  cookies.set(PAIRED_DEVICE_COOKIE_NAME, token, {
    ...SESSION_COOKIE_BASE_OPTIONS,
    expires: expiresAt,
    maxAge: maxAgeSeconds(expiresAt),
  });
}

/** 端末トークンの Cookie を消す（この端末の登録を解除するとき） */
export function clearPairedDeviceCookie(cookies: ResponseCookies): void {
  cookies.set(PAIRED_DEVICE_COOKIE_NAME, "", { ...SESSION_COOKIE_BASE_OPTIONS, maxAge: 0 });
}

/** 端末側から始めたペアリングの照合トークンを Cookie に書く */
export function setPendingPairingCookie(
  cookies: ResponseCookies,
  pendingToken: string,
  expiresAt: Date,
): void {
  cookies.set(PAIRED_DEVICE_PENDING_COOKIE_NAME, pendingToken, {
    ...SESSION_COOKIE_BASE_OPTIONS,
    expires: expiresAt,
    maxAge: maxAgeSeconds(expiresAt),
  });
}

export function clearPendingPairingCookie(cookies: ResponseCookies): void {
  cookies.set(PAIRED_DEVICE_PENDING_COOKIE_NAME, "", { ...SESSION_COOKIE_BASE_OPTIONS, maxAge: 0 });
}

export function readPairedDeviceToken(cookies: CookieReader): string | null {
  return cookies.get(PAIRED_DEVICE_COOKIE_NAME)?.value || null;
}

export function readPendingPairingToken(cookies: CookieReader): string | null {
  return cookies.get(PAIRED_DEVICE_PENDING_COOKIE_NAME)?.value || null;
}
