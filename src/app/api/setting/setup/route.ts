// src/app/api/setting/setup/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { initializeAdminSetup } from "@/features/core/setting/services/server/settingService";

// eslint-disable-next-line route-authz/require-authz -- 公開: 初回管理者セットアップ（ハンドラ内で既存admin存在チェックにより二重実行を防止）
export const POST = createApiRoute(
  {
    operation: "POST /api/setting/setup",
    operationType: "write",
    skipForDemo: false,
  },
  async (req) => {
    const body = await req.json();
    const user = await initializeAdminSetup(body.data);
    return user;
  },
);
