// src/features/auth/services/server/authorization.ts

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { resolveSessionUser } from "@/features/core/auth/services/server/session/token";
import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";
import type { UserRoleType, UserStatus } from "@/features/core/user/types";

/** proxy.ts で付与された x-pathname ヘッダーから現在のパスを取得する */
async function getRequestPathname(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-pathname");
}

/** redirectTo に ?returnTo=<currentPath> を付与した URL を返す */
function buildReturnBackUrl(redirectTo: string, currentPath: string): string {
  const separator = redirectTo.includes("?") ? "&" : "?";
  return `${redirectTo}${separator}returnTo=${encodeURIComponent(currentPath)}`;
}

type AuthGuardOptions = {
  allowRoles?: UserRoleType[];
  allowStatuses?: readonly UserStatus[];
  redirectTo?: string;
  /** 未認証リダイレクト時に現在のパスを returnTo パラメータとして付与する */
  returnBack?: boolean;
  /** ステータス別のリダイレクト先（redirectTo より優先） */
  statusRedirects?: Partial<Record<UserStatus, string>>;
};

export async function authGuard(options: AuthGuardOptions = {}): Promise<SessionUser | null> {
  const { redirectTo, returnBack = false } = options;

  /** 未認証時のリダイレクト先を構築する（returnBack 有効時は returnTo パラメータを付与） */
  const resolveRedirectUrl = async (): Promise<string | null> => {
    if (!redirectTo) return null;
    if (!returnBack) return redirectTo;
    const currentPath = await getRequestPathname();
    if (!currentPath || currentPath === redirectTo) return redirectTo;
    return buildReturnBackUrl(redirectTo, currentPath);
  };

  // レイアウトやサーバーコンポーネントから呼び出され、Cookie からセッションを検証する。
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);

  if (!token) {
    const url = await resolveRedirectUrl();
    if (url) redirect(url);
    return null;
  }

  // トークンを検証してユーザー情報を取得する。失敗時は未ログインとして扱う。
  const sessionUser = await resolveSessionUser(token);

  if (!sessionUser) {
    const url = await resolveRedirectUrl();
    if (url) redirect(url);
    return null;
  }

  // 許可ロールが指定されている場合はユーザーの権限を照合する。
  if (options.allowRoles && !options.allowRoles.includes(sessionUser.role)) {
    const url = await resolveRedirectUrl();
    if (url) redirect(url);
    return null;
  }

  // 許可ステータスのリストに含まれているかを判定し、利用停止中のユーザーを弾く。
  const allowedStatuses = options.allowStatuses ?? USER_AVAILABLE_STATUSES;

  if (!allowedStatuses.includes(sessionUser.status)) {
    // ステータス別のリダイレクト先が指定されている場合はそちらを優先（returnTo は付与しない）
    const statusRedirect = options.statusRedirects?.[sessionUser.status];
    if (statusRedirect) {
      redirect(statusRedirect);
    }
    const url = await resolveRedirectUrl();
    if (url) redirect(url);
    return null;
  }

  return sessionUser;
}
