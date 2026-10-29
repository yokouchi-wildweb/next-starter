// src/app/api/paired-devices/pairing-requests/route.ts
//
// 管理側: 端末から始めたペアリングの情報（承認画面で端末を確かめる材料）。?code=XXXX-XXXX
// ログインユーザーなら誰でも引ける（承認には管理権限が要る）。コードはレート制限で守る。

import {
  checkPairedDeviceRateLimit,
  getDevicePairingRequest,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { readDeviceRequestInfo } from "@/features/core/pairedDevice/services/server/session";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute(
  {
    operation: "GET /api/paired-devices/pairing-requests",
    operationType: "read",
    access: "custom",
    // IP 単位は緩い上限だけ。主な制限はユーザー単位（下）
    rateLimit: "pairedDeviceManageIp",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const user = await requireAuthenticated();
      const limited = await checkPairedDeviceRateLimit("pairedDeviceManage", `user:${user.userId}`);
      if (limited) return limited;
      const code = req.nextUrl.searchParams.get("code");
      if (!code) {
        throw new DomainError("コードを指定してください", { status: 400 });
      }
      const approverIp = readDeviceRequestInfo(req.headers).ip;
      return { request: await getDevicePairingRequest(code, { ip: approverIp }) };
    }),
);
