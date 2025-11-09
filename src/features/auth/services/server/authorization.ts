// src/features/auth/services/server/authorization.ts

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { parseSessionCookie } from "@/lib/jwt";
import type { SessionUser } from "@/features/auth/entities/session";
import { resolveSessionUser } from "@/features/auth/services/server/session/token";
import { USER_AVAILABLE_STATUSES } from "@/constants/user";
import type { UserRoleType, UserStatus } from "@/types/user";

type AuthGuardOptions = {
  allowRoles?: UserRoleType[];
  allowStatuses?: readonly UserStatus[];
  redirectTo?: string;
};

export async function authGuard(options: AuthGuardOptions = {}): Promise<SessionUser | null> {
  // レイアウトやサーバーコンポーネントから呼び出され、Cookie からセッションを検証する。
  const cookieStore = await cookies();
  const token = parseSessionCookie(cookieStore);

  if (!token) {
    if (options.redirectTo) {
      redirect(options.redirectTo);
    }
    return null;
  }

  // トークンを検証してユーザー情報を取得する。失敗時は未ログインとして扱う。
  const sessionUser = await resolveSessionUser(token);

  if (!sessionUser) {
    if (options.redirectTo) {
      redirect(options.redirectTo);
    }
    return null;
  }

  // 許可ロールが指定されている場合はユーザーの権限を照合する。
  if (options.allowRoles && !options.allowRoles.includes(sessionUser.role)) {
    if (options.redirectTo) {
      redirect(options.redirectTo);
    }
    return null;
  }

  // 許可ステータスのリストに含まれているかを判定し、利用停止中のユーザーを弾く。
  const allowedStatuses = options.allowStatuses ?? USER_AVAILABLE_STATUSES;

  if (!allowedStatuses.includes(sessionUser.status)) {
    if (options.redirectTo) {
      redirect(options.redirectTo);
    }
    return null;
  }

  return sessionUser;
}
