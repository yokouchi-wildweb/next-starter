// src/app/api/auth/pre-register/route.ts

import { createApiRoute } from "@/lib/routeFactory";
import { preRegister } from "@/features/core/auth/services/server/preRegistration";
import { getClientIp } from "@/lib/request/getClientIp";

export const POST = createApiRoute(
  {
    operation: "POST /api/auth/pre-register",
    operationType: "write",
    skipForDemo: true,
  },
  async (req) => {
    const body = await req.json();
    const ip = await getClientIp();
    const { user } = await preRegister({ ...body, ip: ip ?? undefined });
    return { user };
  },
);
