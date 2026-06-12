// src/app/api/setting/setup/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { initializeAdminSetup } from "@/features/core/setting/services/server/settingService";

export const POST = createApiRoute(
  {
    operation: "POST /api/setting/setup",
    operationType: "write",
    access: "public",
    skipForDemo: false,
  },
  async (req) => {
    const body = await req.json();
    const user = await initializeAdminSetup(body.data);
    return user;
  },
);
