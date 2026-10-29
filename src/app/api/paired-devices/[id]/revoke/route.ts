// src/app/api/paired-devices/[id]/revoke/route.ts
//
// 管理側: 端末を失効させる。次のリクエストから認証に失敗する（再ペアリングで戻せる）。

import { z } from "zod";

import {
  revokePairedDevice,
  toPairedDeviceForAdmin,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";

type Params = { id: string };

const RevokeSchema = z.object({ reason: z.string().max(1000).nullable().optional() });

export const POST = createApiRoute<Params, unknown, "authenticated">(
  {
    operation: "POST /api/paired-devices/[id]/revoke",
    operationType: "write",
    access: "authenticated",
  },
  async (req, { params, user }) =>
    withPairedDeviceErrors(async () => {
      const parsed = RevokeSchema.safeParse((await req.json().catch(() => null)) ?? {});
      if (!parsed.success) {
        throw new DomainError("入力が不正です", { status: 400 });
      }
      const device = await revokePairedDevice(params.id, user, { reason: parsed.data.reason });
      return { device: toPairedDeviceForAdmin(device) };
    }),
);
