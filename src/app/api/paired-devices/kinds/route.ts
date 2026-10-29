// src/app/api/paired-devices/kinds/route.ts
//
// 管理側: このユーザーが管理できる端末の種類（登録画面の選択肢）。

import {
  listManageablePairedDeviceKinds,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { createApiRoute } from "@/wiring/apiRoute";

export const GET = createApiRoute(
  {
    operation: "GET /api/paired-devices/kinds",
    operationType: "read",
    access: "authenticated",
  },
  async (_req, { user }) =>
    withPairedDeviceErrors(async () => {
      return { kinds: await listManageablePairedDeviceKinds(user) };
    }),
);
