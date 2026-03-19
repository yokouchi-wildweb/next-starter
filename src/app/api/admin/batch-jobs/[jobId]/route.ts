// src/app/api/admin/batch-jobs/[jobId]/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { batchJobService } from "@/features/batchJob/services/server";

type RouteParams = { jobId: string };

export const GET = createApiRoute<RouteParams>(
  {
    operation: "GET /api/admin/batch-jobs/[jobId]",
    operationType: "read",
  },
  async (_req, { session, params }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

    const { jobId } = params;
    const progress = await batchJobService.getProgress(jobId);

    return progress;
  },
);
