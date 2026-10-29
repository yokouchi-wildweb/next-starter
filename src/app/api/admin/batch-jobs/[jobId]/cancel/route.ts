// src/app/api/admin/batch-jobs/[jobId]/cancel/route.ts

import { createApiRoute } from "@/wiring/apiRoute";
import { batchJobService } from "@/features/batchJob/services/server";

type RouteParams = { jobId: string };

export const PATCH = createApiRoute<RouteParams>(
  {
    operation: "PATCH /api/admin/batch-jobs/[jobId]/cancel",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (_req, { params }) => {
    const { jobId } = params;
    const job = await batchJobService.cancel(jobId);

    return job;
  },
);
