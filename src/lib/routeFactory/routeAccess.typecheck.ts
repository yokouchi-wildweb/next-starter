// src/lib/routeFactory/routeAccess.typecheck.ts
// 型の契約の検査（pnpm typecheck が読む。どこからも import せず、実行もしない）。
// - access は 3 語だけ（"custom" = ハンドラで自前に認可する口は無い）
// - ハンドラの ctx に token だけのセッション（session）は無い。主体は ctx.user
// - ctx.user は "public" だけ null 可

import type { SessionUser } from "@/features/core/auth/entities/session";

import type { ApiRouteContext, ApiRouteUser, RouteAccess } from "./createApiRoute";

// @ts-expect-error "custom" は access に書けない
export const customIsNotAnAccess: RouteAccess = "custom";

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export const contextHasNoSession: "session" extends keyof ApiRouteContext ? false : true = true;
export const publicUserIsNullable: Equals<ApiRouteUser<"public">, SessionUser | null> = true;
export const authenticatedUserIsPresent: Equals<ApiRouteUser<"authenticated">, SessionUser> = true;
export const roleUserIsPresent: Equals<ApiRouteUser<{ roleCategories: string[] }>, SessionUser> = true;
