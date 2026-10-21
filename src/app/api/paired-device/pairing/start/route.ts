// src/app/api/paired-device/pairing/start/route.ts
//
// 端末側: 端末からペアリングを始める。画面に表示するコードを返し、
// 承認を受け取るための照合トークンを httpOnly Cookie に入れる。

import { NextResponse } from "next/server";

import { PAIRED_DEVICE_CONFIG } from "@/config/app/paired-device.config";
import {
  rejectCrossSiteRequest,
  startDevicePairing,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import {
  readDeviceRequestInfo,
  setPendingPairingCookie,
} from "@/features/core/pairedDevice/services/server/session";
import { createApiRoute } from "@/lib/routeFactory";

export const POST = createApiRoute(
  {
    operation: "POST /api/paired-device/pairing/start",
    operationType: "write",
    skipForDemo: false,
    // 公開: ペアリング前の端末は認証手段を持たない。承認は管理権限のあるユーザーが別途行う
    access: "public",
    rateLimit: "pairedDevicePairingStart",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const crossSite = rejectCrossSiteRequest(req);
      if (crossSite) return crossSite;
      const started = await startDevicePairing(readDeviceRequestInfo(req.headers));
      const response = NextResponse.json({
        code: started.code,
        expiresAt: started.expiresAt,
        pollIntervalSeconds: PAIRED_DEVICE_CONFIG.pairing.pollIntervalSeconds,
      });
      setPendingPairingCookie(response.cookies, started.pendingToken, started.expiresAt);
      return response;
    }),
);
