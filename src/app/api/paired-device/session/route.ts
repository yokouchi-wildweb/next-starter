// src/app/api/paired-device/session/route.ts
//
// 端末側: この端末が登録済みかを返す（GET）・この端末の登録を解除する（DELETE）。
// 未登録の端末は 401 ではなく { device: null } を返す（画面が「ペアリング画面を出すか」を判断する用途のため）。

import { NextResponse } from "next/server";

import {
  unpairPairedDevice,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import {
  authenticateRequestDevice,
  clearPairedDeviceCookie,
  syncPairedDeviceCookie,
} from "@/features/core/pairedDevice/services/server/session";
import { createApiRoute } from "@/lib/routeFactory";

export const GET = createApiRoute(
  {
    operation: "GET /api/paired-device/session",
    operationType: "read",
    // 公開: 端末 Cookie の有無を確かめるルート。端末として認証できなければ device: null を返すだけ
    access: "public",
  },
  async (req) => {
    const authenticated = await authenticateRequestDevice(req);
    const response = NextResponse.json({ device: authenticated?.device ?? null });
    // 表示専用の端末は、このルートを定期的に呼ぶ（heartbeat）ことで Cookie の期限を保つ
    return authenticated ? syncPairedDeviceCookie(response, req, authenticated) : response;
  },
);

export const DELETE = createApiRoute(
  {
    operation: "DELETE /api/paired-device/session",
    operationType: "write",
    skipForDemo: false,
    // 公開: 端末 Cookie を持つ端末自身が自分の登録を解除する。Cookie が無ければ何もしない
    access: "public",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const authenticated = await authenticateRequestDevice(req);
      if (authenticated) await unpairPairedDevice(authenticated.device.deviceId);
      const response = NextResponse.json({ ok: true });
      clearPairedDeviceCookie(response.cookies);
      return response;
    }),
);
