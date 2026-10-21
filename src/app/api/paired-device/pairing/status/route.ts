// src/app/api/paired-device/pairing/status/route.ts
//
// 端末側: 端末から始めたペアリングが承認されたかを確認する。
// 承認済みなら端末トークンを Cookie に入れ（1 回だけ）、照合トークンの Cookie を消す。

import { NextResponse } from "next/server";

import {
  checkPairedDeviceRateLimit,
  pollDevicePairing,
  rejectCrossSiteRequest,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { hashSecretToken } from "@/lib/crypto";
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
    // IP 単位は緩い上限だけ（店内の端末は同じ IP）。主な制限は照合トークン単位（下）
    rateLimit: "pairedDevicePairingPollIp",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const crossSite = rejectCrossSiteRequest(req);
      if (crossSite) return crossSite;
      const pendingToken = readPendingPairingToken(req.cookies) ?? "";
      if (pendingToken) {
        const limited = await checkPairedDeviceRateLimit(
          "pairedDevicePairingPoll",
          `pending:${hashSecretToken(pendingToken)}`,
        );
        if (limited) return limited;
      }
      const result = await pollDevicePairing(pendingToken, readDeviceRequestInfo(req.headers));
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
