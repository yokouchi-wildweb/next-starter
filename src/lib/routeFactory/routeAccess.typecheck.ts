// src/lib/routeFactory/routeAccess.typecheck.ts
// 型の契約の検査（pnpm typecheck が読む。どこからも import せず、実行もしない）。
// - access は 3 語だけ（"custom" = ハンドラで自前に認可する口は無い）
// - ハンドラの ctx に token だけのセッション（session）は無い。主体は ctx.user
// - ctx.user は "public" だけ null 可
// - user: "skip"（利用者の DB 引きを省く）は "public" だけ書ける

import type { ApiRouteConfig, ApiRouteContext, ApiRouteUser, RouteAccess } from "./createApiRoute";

// @ts-expect-error "custom" は access に書けない
export const customIsNotAnAccess: RouteAccess = "custom";

type User = { userId: string; role: "admin"; status: "active"; isDemo: boolean };

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export const contextHasNoSession: "session" extends keyof ApiRouteContext ? false : true = true;
export const publicUserIsNullable: Equals<ApiRouteUser<"public", User>, User | null> = true;
export const authenticatedUserIsPresent: Equals<ApiRouteUser<"authenticated", User>, User> = true;
export const roleUserIsPresent: Equals<ApiRouteUser<{ roleCategories: string[] }, User>, User> = true;

const base = { operation: "GET /api/x", operationType: "read" } as const;
export const publicMaySkipUser: ApiRouteConfig<"public"> = { ...base, access: "public", user: "skip" };
export const publicDefaultResolvesUser: ApiRouteConfig<"public"> = { ...base, access: "public" };
// @ts-expect-error "authenticated" は利用者が要るので skip を書けない
export const authenticatedCannotSkipUser: ApiRouteConfig<"authenticated"> = { ...base, access: "authenticated", user: "skip" };
// @ts-expect-error roles も同じ
export const roleCannotSkipUser: ApiRouteConfig<{ roles: string[] }> = { ...base, access: { roles: ["admin"] }, user: "skip" };
// @ts-expect-error "skip" 以外の語は無い
export const unknownUserResolution: ApiRouteConfig<"public"> = { ...base, access: "public", user: "lazy" };
