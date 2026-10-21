// src/app/api/paired-devices/kinds/route.ts
//
// 管理側: このユーザーが管理できる端末の種類（登録画面の選択肢）。

import {
  listManageablePairedDeviceKinds,
  withPairedDeviceErrors,
} from "@/features/core/pairedDevice/services/server";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { createApiRoute } from "@/lib/routeFactory";

export const GET = createApiRoute(
  {
    operation: "GET /api/paired-devices/kinds",
    operationType: "read",
    access: "custom",
  },
  async () =>
    withPairedDeviceErrors(async () => {
      const user = await requireAuthenticated();
      return { kinds: await listManageablePairedDeviceKinds(user) };
    }),
);
