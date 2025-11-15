// src/app/api/[domain]/route.ts
import type { NextRequest } from "next/server";

import { withDomainService } from "./utils/withDomainService";
import type { DomainParams } from "@/types/params";

// GET /api/[domain] : 指定ドメインの一覧を取得
export async function GET(_: NextRequest, { params }: DomainParams) {
  return withDomainService(params, (service) => service.list(), {
    operation: "GET /api/[domain]",
  });
}

// POST /api/[domain] : 指定ドメインの新規データを作成
export async function POST(req: NextRequest, { params }: DomainParams) {
  return withDomainService(
    params,
    async (service) => {
      const { data } = await req.json();
      return service.create(data);
    },
    {
      operation: "POST /api/[domain]",
    },
  );
}
