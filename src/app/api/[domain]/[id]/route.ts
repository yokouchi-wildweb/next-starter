// src/app/api/[domain]/[id]/route.ts
import type { NextRequest } from "next/server";

import { withDomainService } from "../utils/withDomainService";
import type { DomainIdParams } from "@/types/params";

// GET /api/[domain]/[id] : IDで単一データを取得
export async function GET(_: NextRequest, { params }: DomainIdParams) {
  return withDomainService(
    params,
    (service, { params: resolvedParams }) => service.get(resolvedParams.id),
    {
      operation: "GET /api/[domain]/[id]",
    },
  );
}

// PUT /api/[domain]/[id] : 指定IDのデータを更新
export async function PUT(req: NextRequest, { params }: DomainIdParams) {
  return withDomainService(
    params,
    async (service, { params: resolvedParams }) => {
      const { data } = await req.json();
      return service.update(resolvedParams.id, data);
    },
    {
      operation: "PUT /api/[domain]/[id]",
    },
  );
}

// DELETE /api/[domain]/[id] : 指定IDのデータを削除
export async function DELETE(_: NextRequest, { params }: DomainIdParams) {
  return withDomainService(
    params,
    async (service, { params: resolvedParams }) => {
      await service.remove(resolvedParams.id);
      return { success: true };
    },
    {
      operation: "DELETE /api/[domain]/[id]",
    },
  );
}
