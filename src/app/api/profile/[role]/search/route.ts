// src/app/api/profile/[role]/search/route.ts

import { NextResponse } from "next/server";

import { createApiRoute } from "src/lib/routeFactory";
import { getProfileBase } from "@/features/core/userProfile/utils/profileBaseHelpers";
import type { SearchParams, WithOptions } from "@/lib/crud";
import {
  BadRequestError,
  parseOrderBy,
  parsePositiveInteger,
  parseBooleanFlag,
  parseWithRelations,
  parseSearchFields,
  parseSearchPriorityFields,
  parseWhere,
} from "@/app/api/[domain]/search/utils";

type Params = { role: string };

// GET /api/profile/[role]/search : 指定ロールのプロフィールを検索
export const GET = createApiRoute<Params>(
  {
    operation: "GET /api/profile/[role]/search",
    operationType: "read",
  },
  async (req, { params }) => {
    const profileBase = getProfileBase(params.role);
    if (!profileBase) {
      return new NextResponse("Not Found", { status: 404 });
    }

    try {
      const query = req.nextUrl.searchParams;

      const page = parsePositiveInteger(query.get("page"), "page");
      const limit = parsePositiveInteger(query.get("limit"), "limit");
      const orderBy = parseOrderBy(query.getAll("orderBy"));
      const searchFields = parseSearchFields(query.getAll("searchFields"));
      const searchPriorityFields = parseSearchPriorityFields(query.getAll("searchPriorityFields"));
      const prioritizeSearchHits = parseBooleanFlag(
        query.get("prioritizeSearchHits"),
        "prioritizeSearchHits",
      );
      const where = parseWhere(query.get("where"));
      const searchQuery = query.get("searchQuery") ?? undefined;

      const withRelations = parseWithRelations(query.get("withRelations"));
      const withCount = parseBooleanFlag(query.get("withCount"), "withCount");

      const searchParams: SearchParams & WithOptions = {};
      if (typeof page === "number") searchParams.page = page;
      if (typeof limit === "number") searchParams.limit = limit;
      if (orderBy) searchParams.orderBy = orderBy;
      if (searchQuery) searchParams.searchQuery = searchQuery;
      if (searchFields) searchParams.searchFields = searchFields;
      if (where) searchParams.where = where;
      if (searchPriorityFields) searchParams.searchPriorityFields = searchPriorityFields;
      if (typeof prioritizeSearchHits === "boolean")
        searchParams.prioritizeSearchHits = prioritizeSearchHits;
      if (withRelations) searchParams.withRelations = withRelations;
      if (withCount) searchParams.withCount = withCount;

      return profileBase.search(searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
