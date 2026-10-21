// src/features/core/pairedDevice/services/server/session/getSessionDevice.ts
//
// リクエストの主体となっている登録端末を解決する。getSessionUser の端末版。
// ユーザーセッションとは独立しており、端末の Cookie はユーザーの認可（getSessionUser・/api/me/**）に一切影響しない。

import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";

import type { SessionDevice } from "@/features/core/pairedDevice/entities/model";

import { authenticateDeviceToken, type AuthenticatedDevice, type DeviceRequestInfo } from "../deviceToken";
import { readPairedDeviceToken } from "./cookies";

type HeaderReader = { get(name: string): string | null };

/** リクエストヘッダーから IP（x-forwarded-for の先頭）と User-Agent を取り出す */
export function readDeviceRequestInfo(headerList: HeaderReader): DeviceRequestInfo {
  return {
    ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: headerList.get("user-agent") || null,
  };
}

/**
 * Route Handler 用。端末を認証し、有効期限を延長した場合はその情報も返す
 * （呼び出し側がレスポンスの Cookie を書き直す。createDeviceRoute が自動で行う）。
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
 * Server Component からは Cookie を書けないため、ここでは有効期限の延長分を Cookie に反映しない
 * （DB 側の期限は延びる。Cookie は端末が API を呼んだときに createDeviceRoute が書き直す）。
 */
export const getSessionDevice = cache(async (): Promise<SessionDevice | null> => {
  const cookieStore = await cookies();
  const token = readPairedDeviceToken(cookieStore);
  if (!token) return null;
  const result = await authenticateDeviceToken(token, readDeviceRequestInfo(await headers()));
  return result?.device ?? null;
});
