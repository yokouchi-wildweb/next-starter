// src/app/api/paired-devices/pairing-requests/approve/route.ts
//
// 管理側: 端末から始めたペアリングを承認し、既存の端末を割り当てる（deviceId）か、
// その場で端末を登録する（device）。端末は次の確認で端末トークンを受け取る。

import { ApproveDevicePairingSchema } from "@/features/core/pairedDevice/entities/schema";
import {
  approveDevicePairing,
  toPairedDeviceForAdmin,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/lib/routeFactory";

export const POST = createApiRoute(
  {
    operation: "POST /api/paired-devices/pairing-requests/approve",
    operationType: "write",
    access: "custom",
    rateLimit: "pairedDeviceClaim",
  },
  async (req) =>
    withPairedDeviceErrors(async () => {
      const user = await requireAuthenticated();
      const parsed = ApproveDevicePairingSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        throw new DomainError("入力が不正です", { status: 400 });
      }
      const { device } = await approveDevicePairing(parsed.data, user);
      return { device: toPairedDeviceForAdmin(device) };
    }),
);
