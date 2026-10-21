// src/features/core/pairedDevice/services/server/session/getSessionDevice.ts
//
// リクエストの主体となっている登録端末を解決する。getSessionUser の端末版。
// ユーザーセッションとは独立しており、端末の Cookie はユーザーの認可（getSessionUser・/api/me/**）に一切影響しない。

import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";
import { readClientIp } from "@/lib/request";

import { authenticateDeviceToken, type AuthenticatedDevice, type DeviceRequestInfo } from "../deviceToken";
import { readPairedDeviceToken, setPairedDeviceCookie } from "./cookies";

type HeaderReader = { get(name: string): string | null };

/** リクエストヘッダーから IP（getClientIp と同じ順序で読む）と User-Agent を取り出す */
export function readDeviceRequestInfo(headerList: HeaderReader): DeviceRequestInfo {
  return {
    ip: readClientIp(headerList),
    userAgent: headerList.get("user-agent") || null,
  };
}

/**
 * Route Handler 用。端末を認証し、現在の有効期限（必要なら延長後）も返す。
 * 呼び出し側は応答に syncPairedDeviceCookie で Cookie を書き直す（createDeviceRoute は自動で行う）。
 */
export async function authenticateRequestDevice(req: NextRequest): Promise<AuthenticatedDevice | null> {
  const token = readPairedDeviceToken(req.cookies);
  if (!token) return null;
  return authenticateDeviceToken(token, readDeviceRequestInfo(req.headers));
}

/**
 * Server Component / loader / layout 用。認証済みの端末、無ければ null。
 * 失効・scope 変更は DB を引くので即時に反映される。同一リクエスト内の重複呼び出しは 1 回に圧縮される。
 *
 * Server Component からは Cookie を書けないため、ここでは有効期限を延長しない（lastSeenAt の更新のみ）。
 * DB の期限だけが延びて Cookie が先に切れるのを防ぐため。延長は Cookie を書ける API 応答
 * （createDeviceRoute・GET /api/paired-device/session）で行う。表示専用の端末は README の heartbeat を置く。
 */
export const getSessionDevice = cache(async (): Promise<SessionDevice | null> => {
  const cookieStore = await cookies();
  const token = readPairedDeviceToken(cookieStore);
  if (!token) return null;
  const result = await authenticateDeviceToken(token, readDeviceRequestInfo(await headers()), {
    extendExpiry: false,
  });
  return result?.device ?? null;
});

/**
 * 認証済みの端末への応答に、現在の有効期限で端末 Cookie を書き直す（トークンの値は同じ）。
 * 延長したかどうかに関係なく毎回書くことで、DB と Cookie の期限のずれを解消する。
 * 未認証・失効の応答では呼ばない（失効したトークンの Cookie を延ばさない）。
 */
export function syncPairedDeviceCookie(
  response: NextResponse,
  req: NextRequest,
  authenticated: AuthenticatedDevice,
): NextResponse {
  const token = readPairedDeviceToken(req.cookies);
  if (token) setPairedDeviceCookie(response.cookies, token, authenticated.tokenExpiresAt);
  // 端末ごとの応答（Set-Cookie を含む）を共有キャッシュに載せない
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
