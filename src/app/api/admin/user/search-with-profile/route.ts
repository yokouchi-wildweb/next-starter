// src/app/api/admin/user/search-with-profile/route.ts
//
// ユーザー + プロフィール横断検索 API。
// クエリパラメータ role でプロフィールの searchFields も含めて検索する。

import { NextResponse } from "next/server";

import { createApiRoute } from "src/lib/routeFactory";
import { userService } from "@/features/core/user/services/server/userService";
import type { SearchWithProfileParams } from "@/features/core/user/services/server/wrappers/searchWithProfile";

import {
  BadRequestError,
  parseOrderBy,
  parsePositiveInteger,
  parseBooleanFlag,
  parseWithRelations,
  parseWhere,
} from "@/app/api/[domain]/search/utils";

// GET /api/admin/user/search-with-profile?role=contributor&searchQuery=田中
export const GET = createApiRoute(
  {
    operation: "GET /api/admin/user/search-with-profile",
    operationType: "read",
  },
  async (req) => {
    try {
      const query = req.nextUrl.searchParams;

      const role = query.get("role");
      if (!role) {
        return NextResponse.json(
          { message: "role パラメータは必須です" },
          { status: 400 },
        );
      }

      const page = parsePositiveInteger(query.get("page"), "page");
      const limit = parsePositiveInteger(query.get("limit"), "limit");
      const orderBy = parseOrderBy(query.getAll("orderBy"));
      const where = parseWhere(query.get("where"));
      const searchQuery = query.get("searchQuery") ?? undefined;
      const profileWhere = parseWhere(query.get("profileWhere"));
      const withRelations = parseWithRelations(query.get("withRelations"));
      const withCount = parseBooleanFlag(query.get("withCount"), "withCount");

      const searchParams: SearchWithProfileParams = {};
      if (typeof page === "number") searchParams.page = page;
      if (typeof limit === "number") searchParams.limit = limit;
      if (orderBy) searchParams.orderBy = orderBy;
      if (searchQuery) searchParams.searchQuery = searchQuery;
      if (where) searchParams.where = where;
      if (profileWhere) searchParams.profileWhere = profileWhere;
      if (withRelations) searchParams.withRelations = withRelations;
      if (withCount) searchParams.withCount = withCount;

      return userService.searchWithProfile(role, searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
