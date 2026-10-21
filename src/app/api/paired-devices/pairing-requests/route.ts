// src/app/api/paired-devices/pairing-requests/route.ts
//
// 管理側: 端末から始めたペアリングの情報（承認画面で端末を確かめる材料）。?code=XXXX-XXXX
// ログインユーザーなら誰でも引ける（承認には管理権限が要る）。コードはレート制限で守る。

import {
  getDevicePairingRequest,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/lib/routeFactory";

export const GET = createApiRoute(
  {
    operation: "GET /api/paired-devices/pairing-requests",
    operationType: "read",
    access: "custom",
    rateLimit: "pairedDeviceClaim",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      await requireAuthenticated();
      const code = req.nextUrl.searchParams.get("code");
      if (!code) {
        throw new DomainError("コードを指定してください", { status: 400 });
      }
      return { request: await getDevicePairingRequest(code) };
    }),
);
