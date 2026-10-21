// src/app/api/paired-device/pairing/claim/route.ts
//
// 端末側: 管理者が発行したペアリングコードを送り、端末トークン（Cookie）を受け取る。

import { NextResponse } from "next/server";

import { ClaimPairingCodeSchema } from "@/features/core/pairedDevice/entities/schema";
import {
  claimPairingCode,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import {
  readDeviceRequestInfo,
  setPairedDeviceCookie,
} from "@/features/core/pairedDevice/services/server/session";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/lib/routeFactory";

export const POST = createApiRoute(
  {
    operation: "POST /api/paired-device/pairing/claim",
    operationType: "write",
    skipForDemo: false,
    // 公開: ペアリング前の端末は認証手段を持たない。コード（8 文字・10 分で失効）とレート制限で守る
    access: "public",
    rateLimit: "pairedDeviceClaim",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const parsed = ClaimPairingCodeSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        throw new DomainError("コードを入力してください", { status: 400 });
      }
      const completed = await claimPairingCode(parsed.data.code, readDeviceRequestInfo(req.headers));
      const response = NextResponse.json({ device: completed.device });
      setPairedDeviceCookie(response.cookies, completed.token, completed.expiresAt);
      return response;
    }),
);
