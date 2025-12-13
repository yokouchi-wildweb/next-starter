// src/app/api/[domain]/[id]/restore/route.ts
import type { NextRequest } from "next/server";

import { withDomainService } from "../../utils/withDomainService";
import type { DomainIdParams } from "@/types/params";

// POST /api/[domain]/[id]/restore : ソフトデリートしたデータを復旧
export async function POST(_: NextRequest, { params }: DomainIdParams) {
  return withDomainService(
    params,
    (service, { params: resolvedParams }) => service.restore(resolvedParams.id),
    {
      supports: "restore",
      operation: "POST /api/[domain]/[id]/restore",
    },
  );
}
