// src/app/api/admin/batch-jobs/[jobId]/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { batchJobService } from "@/features/batchJob/services/server";

type RouteParams = { jobId: string };

export const GET = createApiRoute<RouteParams>(
  {
    operation: "GET /api/admin/batch-jobs/[jobId]",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (_req, { params }) => {
    const { jobId } = params;
    const progress = await batchJobService.getProgress(jobId);

    return progress;
  },
);
