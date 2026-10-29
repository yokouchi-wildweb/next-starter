// src/app/api/admin/batch-jobs/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiRoute } from "@/wiring/apiRoute";
import { batchJobService } from "@/features/batchJob/services/server";

const CreateBatchJobPayloadSchema = z.object({
  jobType: z.string().min(1),
  jobKey: z.string().min(1),
  params: z.unknown().optional(),
  itemKeys: z.array(z.string().min(1)).min(1, { message: "対象アイテムが0件です。" }),
  batchSize: z.coerce.number().int().min(1).optional(),
  maxRetryCount: z.coerce.number().int().min(0).optional(),
  targetQuery: z.unknown().optional(),
});

export const POST = createApiRoute(
  {
    operation: "POST /api/admin/batch-jobs",
    operationType: "write",
    access: { roleCategories: ["admin"] },
    skipForDemo: false,
  },
  async (req) => {
    let payload: z.infer<typeof CreateBatchJobPayloadSchema>;
    try {
      const json = await req.json();
      const parsed = CreateBatchJobPayloadSchema.safeParse(json);
      if (!parsed.success) {
        const errorMessage = parsed.error.errors[0]?.message ?? "入力値が不正です。";
        return NextResponse.json({ message: errorMessage }, { status: 400 });
      }
      payload = parsed.data;
    } catch {
      return NextResponse.json({ message: "リクエストボディの解析に失敗しました。" }, { status: 400 });
    }

    const job = await batchJobService.createJob({
      jobType: payload.jobType,
      jobKey: payload.jobKey,
      params: payload.params,
      itemKeys: payload.itemKeys,
      batchSize: payload.batchSize,
      maxRetryCount: payload.maxRetryCount,
      targetQuery: payload.targetQuery,
    });

    return job;
  },
);
