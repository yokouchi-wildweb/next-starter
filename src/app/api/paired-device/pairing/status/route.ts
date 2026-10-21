// src/app/api/paired-device/pairing/status/route.ts
//
// 端末側: 端末から始めたペアリングが承認されたかを確認する。
// 承認済みなら端末トークンを Cookie に入れ（1 回だけ）、照合トークンの Cookie を消す。

import { NextResponse } from "next/server";

import {
  pollDevicePairing,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import {
  clearPendingPairingCookie,
  readDeviceRequestInfo,
  readPendingPairingToken,
  setPairedDeviceCookie,
} from "@/features/core/pairedDevice/services/server/session";
import { createApiRoute } from "@/lib/routeFactory";

export const POST = createApiRoute(
  {
    operation: "POST /api/paired-device/pairing/status",
    // 承認済みならトークンを発行する（状態が変わる）ので POST
    operationType: "write",
    skipForDemo: false,
    // 公開: ペアリングを始めた端末だけが持つ照合トークン（httpOnly Cookie）で照合する
    access: "public",
    rateLimit: "pairedDevicePairingPoll",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const result = await pollDevicePairing(
        readPendingPairingToken(req.cookies) ?? "",
        readDeviceRequestInfo(req.headers),
      );
      if (result.status !== "completed") {
        const response = NextResponse.json({ status: result.status, expiresAt: result.expiresAt });
        if (result.status !== "pending") clearPendingPairingCookie(response.cookies);
        return response;
      }
      const response = NextResponse.json({ status: "completed", device: result.device });
      setPairedDeviceCookie(response.cookies, result.token, result.expiresAt);
      clearPendingPairingCookie(response.cookies);
      return response;
    }),
);
