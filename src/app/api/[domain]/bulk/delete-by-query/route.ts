// src/app/api/[domain]/bulk/delete-by-query/route.ts

import { NextResponse } from "next/server";

import { createDomainRoute } from "src/lib/routeFactory";
import type { WhereExpr } from "@/lib/crud";

type DomainParams = { domain: string };

// POST /api/[domain]/bulk/delete-by-query : クエリ条件で一括削除
export const POST = createDomainRoute<any, DomainParams>(
  {
    operation: "POST /api/[domain]/bulk/delete-by-query",
    operationType: "write",
    supports: "bulkDeleteByQuery",
  },
  async (req, { service }) => {
    const body = await req.json();
    const where = body?.where as WhereExpr | undefined;

    if (!where) {
      return NextResponse.json({ message: "where パラメータは必須です" }, { status: 400 });
    }

    await service.bulkDeleteByQuery(where);
    return { success: true };
  },
);
