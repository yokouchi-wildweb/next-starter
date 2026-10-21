// src/app/api/paired-devices/[id]/pairing-code/route.ts
//
// 管理側: 端末のペアリングコードを発行する（端末で入力してもらう）。
// その端末の未使用コードは取り消される。失効済みの端末に発行すると再ペアリングになる。

import { issuePairingCode, withPairedDeviceErrors } from "@/features/core/pairedDevice/services/server";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { createApiRoute } from "@/lib/routeFactory";

type Params = { id: string };

export const POST = createApiRoute<Params>(
  {
    operation: "POST /api/paired-devices/[id]/pairing-code",
    operationType: "write",
    access: "custom",
  },
  async (_req, { params }) =>
    withPairedDeviceErrors(async () => {
      const user = await requireAuthenticated();
      const issued = await issuePairingCode(params.id, user);
      return { pairingId: issued.pairing.id, code: issued.code, expiresAt: issued.expiresAt };
    }),
);
