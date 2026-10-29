// src/app/api/admin/audit-logs/search/route.ts
//
// 監査ログの横断検索 (管理者専用)。
// 任意の targetType / targetId / actorId / action prefix / 期間で絞り込める。

import { NextResponse } from "next/server";

import { createApiRoute } from "@/wiring/apiRoute";
import { auditLogBase } from "@/features/core/auditLog/services/server";
import type { SearchParams } from "@/lib/crud";

import {
  BadRequestError,
  parseOrderBy,
  parsePositiveInteger,
  parseWhere,
} from "@/app/api/[domain]/search/utils";

// GET /api/admin/audit-logs/search?where=...&page=&limit=&orderBy=...
export const GET = createApiRoute(
  {
    operation: "GET /api/admin/audit-logs/search",
    operationType: "read",
    access: { roleCategories: ["admin"] },
  },
  async (req) => {
    try {
      const query = req.nextUrl.searchParams;

      const page = parsePositiveInteger(query.get("page"), "page");
      const limit = parsePositiveInteger(query.get("limit"), "limit");
      const orderBy = parseOrderBy(query.getAll("orderBy"));
      const where = parseWhere(query.get("where"));
      const searchQuery = query.get("searchQuery") ?? undefined;

      const searchParams: SearchParams = {};
      if (typeof page === "number") searchParams.page = page;
      if (typeof limit === "number") searchParams.limit = limit;
      if (orderBy) searchParams.orderBy = orderBy;
      if (where) searchParams.where = where;
      if (searchQuery) searchParams.searchQuery = searchQuery;

      return auditLogBase.search(searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
