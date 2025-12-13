// src/app/api/[domain]/[id]/hard-delete/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { withDomainService } from "../../utils/withDomainService";
import type { DomainIdParams } from "@/types/params";

// DELETE /api/[domain]/[id]/hard-delete : 完全削除（物理削除）
export async function DELETE(_: NextRequest, { params }: DomainIdParams) {
  return withDomainService(
    params,
    async (service, { params: resolvedParams }) => {
      await service.hardDelete(resolvedParams.id);
      return new NextResponse(null, { status: 204 });
    },
    {
      supports: "hardDelete",
      operation: "DELETE /api/[domain]/[id]/hard-delete",
    },
  );
}
