// src/app/api/paired-devices/[id]/route.ts
//
// 管理側: 端末の詳細（GET。未使用のペアリングコードを含む）と、名前変更・scope の付け替え（PATCH）。

import { UpdatePairedDeviceSchema } from "@/features/core/pairedDevice/entities/schema";
import {
  getManagedPairedDevice,
  listActivePairingsForDevice,
  toPairedDeviceForAdmin,
  updatePairedDevice,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { DomainError } from "@/lib/errors";
import { createApiRoute } from "@/wiring/apiRoute";

type Params = { id: string };

export const GET = createApiRoute<Params, unknown, "authenticated">(
  {
    operation: "GET /api/paired-devices/[id]",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { params, user }) =>
    withPairedDeviceErrors(async () => {
      const device = await getManagedPairedDevice(params.id, user);
      const activePairings = await listActivePairingsForDevice(params.id, user);
      return { device: toPairedDeviceForAdmin(device), activePairings };
    }),
);

export const PATCH = createApiRoute<Params, unknown, "authenticated">(
  {
    operation: "PATCH /api/paired-devices/[id]",
    operationType: "write",
    access: "authenticated",
  },
  async (req, { params, user }) =>
    withPairedDeviceErrors(async () => {
      const parsed = UpdatePairedDeviceSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        throw new DomainError("入力が不正です", { status: 400 });
      }
      const device = await updatePairedDevice(params.id, parsed.data, user);
      return { device: toPairedDeviceForAdmin(device) };
    }),
);
