// src/app/api/paired-devices/pairings/[pairingId]/cancel/route.ts
//
// 管理側: 未使用のペアリングコードを取り消す。

import { cancelDevicePairing, withPairedDeviceErrors } from "@/features/core/pairedDevice/services/server";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { createApiRoute } from "@/lib/routeFactory";

type Params = { pairingId: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/paired-devices/pairings/[pairingId]/cancel",
    operationType: "write",
    access: "custom",
  },
  async (_req, { params }) =>
    withPairedDeviceErrors(async () => {
      const user = await requireAuthenticated();
      await cancelDevicePairing(params.pairingId, user);
      return { ok: true };
    }),
);
