// src/app/api/[domain]/bulk/bulkRelationPayload.ts

import { z } from "zod";

import { DomainError } from "@/lib/errors";

const BulkRelationPayloadSchema = z.object({
  field: z.string().min(1),
  ids: z.array(z.string()),
  targetIds: z.array(z.string()),
});

/** add-relation / remove-relation の本文を読む。件数の上限はサービスが見る */
export async function readBulkRelationPayload(req: Request) {
  const parsed = BulkRelationPayloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new DomainError("リクエストの形式が不正です", { status: 400 });
  }
  return parsed.data;
}
