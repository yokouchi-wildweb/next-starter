// src/app/api/paired-devices/pairings/[pairingId]/cancel/route.ts
//
// 管理側: 未使用のペアリングコードを取り消す。

import { cancelDevicePairing, withPairedDeviceErrors } from "@/features/core/pairedDevice/services/server";
import { createApiRoute } from "@/wiring/apiRoute";

type Params = { pairingId: string };

export const POST = createApiRoute<Params, unknown, "authenticated">(
  {
    operation: "POST /api/paired-devices/pairings/[pairingId]/cancel",
    operationType: "write",
    access: "authenticated",
  },
  async (_req, { params, user }) =>
    withPairedDeviceErrors(async () => {
      await cancelDevicePairing(params.pairingId, user);
      return { ok: true };
    }),
);
