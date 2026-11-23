// src/app/api/[domain]/search/route.ts

import { NextResponse } from "next/server";

import { createDomainRoute } from "@/wiring/apiRoute";
import { resolveSearchLimit } from "@/lib/crud";
import type { BoundedSearchParams, WithOptions } from "@/lib/crud";

import {
  BadRequestError,
  parseOrderBy,
  parsePositiveInteger,
  parseBooleanFlag,
  parseWithRelations,
  parseSearchFields,
  parseSearchRank,
  parseWhere,
  parseRelationWhere,
} from "./utils";

type DomainParams = { domain: string };

// GET /api/[domain]/search : ドメインデータを検索
export const GET = createDomainRoute<any, DomainParams>(
  {
    operation: "GET /api/[domain]/search",
    crudOp: "search",
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
      const searchRank = parseSearchRank(query.get("searchRank"));
      const where = parseWhere(query.get("where"));
      const relationWhere = parseRelationWhere(query.get("relationWhere"));

      const searchQuery = query.get("searchQuery") ?? undefined;

      // WithOptions のパース
      const withRelations = parseWithRelations(query.get("withRelations"));
      const withCount = parseBooleanFlag(query.get("withCount"), "withCount");
      const hasManyLimit = parsePositiveInteger(query.get("hasManyLimit"), "hasManyLimit");

      // サービスへ渡す SearchParams を組み立て
      // limit は既定 100・上限 1000(超えれば 400)。server の search は limit 必須
      const searchParams: BoundedSearchParams & WithOptions = { limit: resolveSearchLimit(limit) };
      if (typeof page === "number") searchParams.page = page;
      if (orderBy) searchParams.orderBy = orderBy;
      if (searchQuery) searchParams.searchQuery = searchQuery;
      if (searchFields) searchParams.searchFields = searchFields;
      if (where) searchParams.where = where;
      if (relationWhere) searchParams.relationWhere = relationWhere;
      if (searchRank !== undefined) searchParams.searchRank = searchRank;
      if (withRelations) searchParams.withRelations = withRelations;
      if (withCount) searchParams.withCount = withCount;
      if (typeof hasManyLimit === "number") searchParams.hasManyLimit = hasManyLimit;

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
