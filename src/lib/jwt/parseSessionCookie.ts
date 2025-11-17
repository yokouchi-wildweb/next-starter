// src/lib/jwt/parseSessionCookie.ts

import { SESSION_COOKIE_NAME } from "./constants";

type CookieSource =
  | string
  | null
  | undefined
  | {
      get(name: string): { value?: string | null } | undefined;
    };

const parseFromHeader = (cookieHeader: string, cookieName: string): string | null => {
  const pairs = cookieHeader.split(/;\s*/);
  for (const pair of pairs) {
    const [name, ...rest] = pair.split("=");
    if (!name) continue;
    if (name.trim() !== cookieName) continue;

    if (rest.length === 0) {
      return null;
    }

    const value = decodeURIComponent(rest.join("="));
    return value.length > 0 ? value : null;
  }

  return null;
};

/**
 * Cookie ヘッダーまたは RequestCookies 相当からセッショントークンを取得する。
 */
export const parseSessionCookie = (
  source: CookieSource,
  cookieName: string = SESSION_COOKIE_NAME,
): string | null => {
  if (!source) {
    return null;
  }

  if (typeof source === "string") {
    return parseFromHeader(source, cookieName);
  }

  const cookie = source.get(cookieName);
  const value = cookie?.value;

  return typeof value === "string" && value.length > 0 ? value : null;
};
