// src/app/api/admin/batch-jobs/[jobId]/execute/route.ts

import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { batchJobService } from "@/features/batchJob/services/server";

type RouteParams = { jobId: string };

const ExecutePayloadSchema = z.object({
  maxDurationMs: z.coerce.number().int().min(1000).optional(),
});

export const POST = createApiRoute<RouteParams>(
  {
    operation: "POST /api/admin/batch-jobs/[jobId]/execute",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (req, { params }) => {
    const { jobId } = params;

    let maxDurationMs: number | undefined;
    try {
      const json = await req.json();
      const parsed = ExecutePayloadSchema.safeParse(json);
      if (parsed.success) {
        maxDurationMs = parsed.data.maxDurationMs;
      }
    } catch {
      // bodyなしの場合はデフォルト値で実行
    }

    const result = await batchJobService.executeAll(jobId, maxDurationMs);

    return result;
  },
);
