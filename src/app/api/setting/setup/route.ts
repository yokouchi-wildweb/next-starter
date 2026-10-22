// src/app/api/setting/setup/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { initializeAdminSetup } from "@/features/core/setting/services/server/settingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/setting/setup",
    operationType: "write",
    access: "public",
    skipForDemo: false,
    rateLimit: "adminSetup",
  },
  async (req) => {
    const body = await req.json();
    // 作成したユーザー行は返さない（未認証ルートのため、UI が必要とする成否だけを返す）
    await initializeAdminSetup(body.data);
    return { success: true };
  },
);
