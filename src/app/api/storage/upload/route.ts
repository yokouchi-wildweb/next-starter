// src/app/api/storage/upload/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";
import { storageService } from "@/lib/storage/server/storageService";
import type { UploadResult } from "@/lib/storage/types";

export const POST = createApiRoute(
  {
    operation: "POST /api/storage/upload",
    operationType: "write",
    skipForDemo: true,
  },
  async (req) => {
    await requireAuthenticated();

    const formData = await req.formData();
    const basePath = formData.get("basePath");
    const file = formData.get("file");

    if (typeof basePath !== "string" || !(file instanceof File)) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const result = await storageService.upload(basePath, file);
    return NextResponse.json<UploadResult>(result);
  },
);
