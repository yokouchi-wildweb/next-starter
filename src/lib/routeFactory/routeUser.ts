// src/lib/routeFactory/routeUser.ts
//
// 利用者の束（RouteUserDeps.resolveUser）を Factory が呼ぶ唯一の入口。
// 束の契約: null = 未ログイン・失効・削除（「利用者がいない」と分かった）、throw = 分からない（DB 障害など）。
// 分からないときは 401（未ログイン）とも JWT のクレームでの通過とも区別し、503 の RouteUserUnavailableError にする。

import { DomainError } from "@/lib/errors";

import type { RouteUserBase, RouteUserDeps } from "./deps";

/** 利用者の確認が一時的にできない（DB 障害など）ときの code。クライアントは未ログインではなく再試行と読む */
export const ROUTE_USER_UNAVAILABLE_CODE = "route_user_unavailable";

/**
 * 利用者を確認できない（認証の失敗ではなく障害）。Factory の応答は 503 + code "route_user_unavailable"。
 * 束の resolveUser が throw したときに Factory が投げる（束は lib の値を import せず、ただ throw すればよい）
 */
export class RouteUserUnavailableError extends DomainError {
  constructor(options: { cause?: unknown } = {}) {
    super("一時的に利用者を確認できません。しばらくしてから再度お試しください。", {
      status: 503,
      code: ROUTE_USER_UNAVAILABLE_CODE,
    });
    this.name = "RouteUserUnavailableError";
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * 束から利用者を解く。throw は RouteUserUnavailableError に包む（土台の try が 503 の応答にする）。
 * stale な JWT のクレームに落として通すことはしない
 */
export async function resolveRouteUser<TUser extends RouteUserBase<TStatus>, TStatus extends string>(
  deps: Pick<RouteUserDeps<TUser, TStatus>, "resolveUser">,
): Promise<TUser | null> {
  try {
    return await deps.resolveUser();
  } catch (error) {
    if (error instanceof RouteUserUnavailableError) throw error;
    throw new RouteUserUnavailableError({ cause: error });
  }
}
