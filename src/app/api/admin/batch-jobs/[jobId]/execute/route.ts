// src/app/api/admin/batch-jobs/[jobId]/execute/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/lib/routeFactory";
import { getRoleCategory } from "@/features/core/user/constants";
import { batchJobService } from "@/features/batchJob/services/server";

type RouteParams = { jobId: string };

const ExecutePayloadSchema = z.object({
  maxDurationMs: z.coerce.number().int().min(1000).optional(),
});

export const POST = createApiRoute<RouteParams>(
  {
    operation: "POST /api/admin/batch-jobs/[jobId]/execute",
    operationType: "write",
    skipForDemo: false,
  },
  async (req, { session, params }) => {
    if (!session || getRoleCategory(session.role) !== "admin") {
      return NextResponse.json({ message: "この操作を行う権限がありません。" }, { status: 403 });
    }

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
