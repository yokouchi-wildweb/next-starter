// src/app/api/[domain]/search/route.ts

import { NextResponse } from "next/server";

import { createDomainRoute } from "src/lib/routeFactory";
import type { SearchParams } from "@/lib/crud";

import {
  BadRequestError,
  parseOrderBy,
  parsePositiveInteger,
  parseBooleanFlag,
  parseSearchFields,
  parseSearchPriorityFields,
  parseWhere,
} from "./utils";

type DomainParams = { domain: string };

// GET /api/[domain]/search : ドメインデータを検索
export const GET = createDomainRoute<any, DomainParams>(
  {
    operation: "GET /api/[domain]/search",
    operationType: "read",
    supports: "search",
  },
  async (req, { service }) => {
    try {
      // クエリパラメータを取得し、検索条件へ変換
      const query = req.nextUrl.searchParams;

      // ページング・ソート・検索対象フィールド・where 条件を個別に解析
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

      // サービスへ渡す SearchParams を組み立て
      const searchParams: SearchParams = {};
      if (typeof page === "number") searchParams.page = page;
      if (typeof limit === "number") searchParams.limit = limit;
      if (orderBy) searchParams.orderBy = orderBy;
      if (searchQuery) searchParams.searchQuery = searchQuery;
      if (searchFields) searchParams.searchFields = searchFields;
      if (where) searchParams.where = where;
      if (searchPriorityFields) searchParams.searchPriorityFields = searchPriorityFields;
      if (typeof prioritizeSearchHits === "boolean")
        searchParams.prioritizeSearchHits = prioritizeSearchHits;

      // ドメインサービスの search を実行し結果を JSON で返却
      return service.search(searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
);
