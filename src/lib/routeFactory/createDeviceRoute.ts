// src/lib/routeFactory/createDeviceRoute.ts
//
// 登録端末（pairedDevice）を主体にするルートのファクトリー。
//
// createApiRoute をラップし、端末の認証を強制した上で「認証済みの端末」をハンドラに渡す。
// 端末の所属（店舗・テーブル等）は device.scope から取る。クライアントが送る id は信用しない。
//
// orUser を指定すると「端末、またはルールに合うログインユーザー」のどちらでも通る
// （例: 店舗タブレットとスタッフ本人のスマホの両方から使う API）。ハンドラは ctx.principal で分岐する。
//
// 端末の Cookie はユーザーの認可に影響しない（端末で /api/me/** や createApiRoute の
// "authenticated" ルートは通らない）。端末に権限を与えるのはこのファクトリーのルートだけ。

import { NextRequest, NextResponse } from "next/server";

import type { RateLimitCategory } from "@/config/app/rate-limit.config";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { getSessionUser } from "@/features/core/auth/services/server/session/getSessionUser";
import {
  checkPairedDeviceRateLimit,
  pairedDeviceErrorResponse,
} from "@/features/core/pairedDevice/services/server/http";
import {
  authenticateRequestDevice,
  syncPairedDeviceCookie,
  type SessionDeviceOf,
} from "@/features/core/pairedDevice/services/server/session";
import { getAuditContext, runWithAuditContext } from "@/lib/audit";
import { isDomainError } from "@/lib/errors";
import { runWithUserDirtyTracking } from "@/lib/userDirty";
import type { PairedDeviceKind } from "@/registry/pairedDeviceKindRegistry";

import { createApiRoute, type ApiRouteConfig, type RouteAccess } from "./createApiRoute";
import { enforceAccessRule } from "./enforceAccess";

/** 端末として通ったときのコンテキスト */
export type DevicePrincipalContext<K extends string, TParams> = {
  params: TParams;
  principal: "device";
  device: SessionDeviceOf<K>;
  user: null;
  /**
   * 共有端末で操作者（スタッフ）を選ぶ機能のための予約枠。現在は常に null。
   * 将来「端末 + PIN で選んだ操作者」を渡すときもハンドラの形を変えずに済むように置いている
   */
  operator: null;
};

/** orUser のルールでユーザーとして通ったときのコンテキスト */
export type UserPrincipalContext<TParams> = {
  params: TParams;
  principal: "user";
  device: null;
  user: SessionUser;
  operator: null;
};

type BaseDeviceRouteConfig<K extends string> = Omit<
  ApiRouteConfig,
  "access" | "rateLimit" | "rateLimitSubnet" | "recaptcha"
> & {
  /** 通す端末の種類。省略時は登録済みのすべての種類 */
  kinds?: readonly K[];
  /**
   * 主体（端末 id またはユーザー id）単位のレート制限。
   * 店舗の端末は同じ回線（同じ IP）から来るため、IP 単位の制限は使わない
   */
  rateLimit?: RateLimitCategory;
};

export type DeviceRouteConfig<K extends string> = BaseDeviceRouteConfig<K> & {
  /** 端末専用（orUser を付けるとハンドラに user が渡るので DeviceOrUserRouteHandler の形になる） */
  orUser?: never;
};

export type DeviceOrUserRouteConfig<K extends string> = BaseDeviceRouteConfig<K> & {
  /** 端末でない場合に、このルールに合うログインユーザーを通す（"authenticated" またはロール指定） */
  orUser: Exclude<RouteAccess, "public" | "custom">;
};

export type DeviceRouteHandler<K extends string, TParams, TResult> = (
  req: NextRequest,
  ctx: DevicePrincipalContext<K, TParams>,
) => Promise<TResult>;

export type DeviceOrUserRouteHandler<K extends string, TParams, TResult> = (
  req: NextRequest,
  ctx: DevicePrincipalContext<K, TParams> | UserPrincipalContext<TParams>,
) => Promise<TResult>;

const unauthenticated = () =>
  NextResponse.json({ message: "端末の認証が必要です。", reason: "not_found" }, { status: 401 });

const forbidden = () =>
  NextResponse.json(
    { message: "この端末ではこの操作を行えません。", reason: "forbidden" },
    { status: 403 },
  );

async function rateLimited(category: RateLimitCategory | undefined, identifier: string) {
  if (!category) return null;
  return checkPairedDeviceRateLimit(category, identifier);
}

/**
 * 登録端末専用ルートのファクトリー。
 * - 端末の認証を強制（Cookie なし・失効・期限切れ → 401 / kind 違い → 403）
 * - ハンドラに認証済みの device（scope 検証済み）を渡す
 * - 監査ログの actor は端末（actorType "device"、actorId = 端末 id）
 * - 端末として通った応答では、毎回 Cookie の期限を DB の期限に合わせて書き直す（必要なら延長）
 * - デモユーザーの書き込みスキップ（skipForDemo）は orUser の user 枝だけに効く
 *
 * @example
 *   export const POST = createDeviceRoute(
 *     { operation: "POST /api/terminal/lending", operationType: "write", kinds: ["table_terminal"] },
 *     async (req, { device }) => lendingService.request({ tableId: device.scope.tableId, ... }),
 *   );
 */
export function createDeviceRoute<
  K extends PairedDeviceKind = PairedDeviceKind,
  TParams = Record<string, string>,
  TResult = unknown,
>(
  config: DeviceOrUserRouteConfig<K>,
  handler: DeviceOrUserRouteHandler<K, TParams, TResult>,
): ReturnType<typeof createApiRoute<TParams, unknown>>;
export function createDeviceRoute<
  K extends PairedDeviceKind = PairedDeviceKind,
  TParams = Record<string, string>,
  TResult = unknown,
>(
  config: DeviceRouteConfig<K>,
  handler: DeviceRouteHandler<K, TParams, TResult>,
): ReturnType<typeof createApiRoute<TParams, unknown>>;
export function createDeviceRoute<K extends PairedDeviceKind, TParams, TResult>(
  config: DeviceRouteConfig<K> | DeviceOrUserRouteConfig<K>,
  rawHandler: DeviceRouteHandler<K, TParams, TResult> | DeviceOrUserRouteHandler<K, TParams, TResult>,
) {
  // user のコンテキストは orUser 指定時（= DeviceOrUserRouteHandler のオーバーロード）にしか渡さない
  const handler = rawHandler as DeviceOrUserRouteHandler<K, TParams, TResult>;
  const { kinds, rateLimit, orUser, skipForDemo, ...apiConfig } = config as DeviceRouteConfig<K> &
    Partial<Pick<DeviceOrUserRouteConfig<K>, "orUser">>;
  // デモユーザーの書き込みスキップは user 枝だけに適用する（createApiRoute と同じ既定）
  const shouldSkipForDemo = skipForDemo ?? apiConfig.operationType === "write";

  // createApiRoute のデモ分岐は主体の判定より前に返るため、ここでは無効にする。
  // そのままだと、デモユーザーの Cookie を持つブラウザ（公開の guest-login で誰でも作れる）の
  // 端末で、端末の認証も処理も通らずに書き込みが 200 で捨てられる
  return createApiRoute<TParams, unknown>(
    { ...apiConfig, access: "custom", skipForDemo: false },
    async (req, { params }) => {
      const authenticated = await authenticateRequestDevice(req);
      const kindMatches =
        !!authenticated && (!kinds || kinds.includes(authenticated.device.kind as K));

      if (authenticated && kindMatches) {
        const { device } = authenticated;
        // 認証済みの端末への応答は、エラー・429 を含めて毎回 Cookie の期限を DB に合わせる
        const respond = (body: unknown) =>
          syncPairedDeviceCookie(
            body instanceof NextResponse ? body : NextResponse.json(body ?? null),
            req,
            authenticated,
          );

        const limited = await rateLimited(rateLimit, `device:${device.deviceId}`);
        if (limited) return respond(limited);

        const run = () =>
          handler(req, {
            params,
            principal: "device",
            device: device as SessionDeviceOf<K>,
            user: null,
            operator: null,
          });
        // 監査の主体を端末にする。userDirty の flush も端末の context の中で終わるよう、内側で敷き直す
        const baseContext = getAuditContext();
        const runAsDevice = () => runWithUserDirtyTracking(run);

        try {
          const result = baseContext
            ? await runWithAuditContext(
                { ...baseContext, actorId: device.deviceId, actorType: "device" },
                runAsDevice,
              )
            : await runAsDevice();
          return respond(result);
        } catch (error) {
          const response = pairedDeviceErrorResponse(error);
          if (response) return respond(response);
          if (isDomainError(error)) {
            console.error(`${apiConfig.operation} failed:`, error);
            return respond(NextResponse.json({ message: error.message }, { status: error.status }));
          }
          throw error;
        }
      }

      if (orUser) {
        const denied = await enforceAccessRule(orUser);
        if (denied) return denied;
        const user = await getSessionUser();
        if (!user) return unauthenticated();
        if (shouldSkipForDemo && user.isDemo) {
          return NextResponse.json({ success: true, demo: true });
        }
        const limited = await rateLimited(rateLimit, `user:${user.userId}`);
        if (limited) return limited;
        try {
          return await handler(req, { params, principal: "user", device: null, user, operator: null });
        } catch (error) {
          const response = pairedDeviceErrorResponse(error);
          if (response) return response;
          throw error;
        }
      }

      return authenticated ? forbidden() : unauthenticated();
    },
  );
}
