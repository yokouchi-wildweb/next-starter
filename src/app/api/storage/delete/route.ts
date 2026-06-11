// src/app/api/storage/delete/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { storageService } from "@/lib/storage/server/storageService";

export const POST = createApiRoute(
  {
    operation: "POST /api/storage/delete",
    operationType: "write",
    skipForDemo: true,
  },
  async (req) => {
    await requireAuthenticated();

    const { pathOrUrl } = await req.json();

    if (typeof pathOrUrl !== "string") {
      return new NextResponse("Bad Request", { status: 400 });
    }

    await storageService.remove(pathOrUrl);
    return { success: true };
  },
);
