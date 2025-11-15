// src/app/api/[domain]/upsert/route.ts
import type { NextRequest } from "next/server";

import { withDomainService } from "../utils/withDomainService";
import type { DomainParams } from "@/types/params";

// PUT /api/[domain]/upsert : 既存データを更新、なければ新規作成
export async function PUT(req: NextRequest, { params }: DomainParams) {
  return withDomainService(
    params,
    async (service) => {
      const { data, options } = await req.json();
      return service.upsert(data, options);
    },
    {
      operation: "PUT /api/[domain]/upsert",
      supports: "upsert",
    },
  );
}
