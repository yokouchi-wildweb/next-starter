// src/app/api/[domain]/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serviceRegistry } from "@/registry/serviceRegistry";
import { isDomainError } from "@/lib/errors";
import type { SearchParams } from "@/lib/crud";
import type { DomainParams } from "@/types/params";

import {
  BadRequestError,
  parseOrderBy,
  parsePositiveInteger,
  parseBooleanFlag,
  parseSearchFields,
  parseSearchPriorityFields,
  parseWhere,
} from "./utils";

// 利用可能なドメインごとのサービスを登録
const services = serviceRegistry;

// GET /api/[domain]/search : ドメインデータを検索
export async function GET(req: NextRequest, { params }: DomainParams) {
  // パスパラメータから対象ドメインを特定
  const { domain } = await params;
  const service = services[domain];
  if (!service || !service.search) return new NextResponse("Not Found", { status: 404 });
  try {
    // クエリパラメータを取得し、検索条件へ変換
    const query = req.nextUrl.searchParams;

    // ページング・ソート・検索対象フィールド・where 条件を個別に解析
    const page = parsePositiveInteger(query.get("page"), "page");
    const limit = parsePositiveInteger(query.get("limit"), "limit");
    const orderBy = parseOrderBy(query.getAll("orderBy"));
    const searchFields = parseSearchFields(query.getAll("searchFields"));
    const searchPriorityFields = parseSearchPriorityFields(query.getAll("searchPriorityFields"));
    const prioritizeSearchHits = parseBooleanFlag(query.get("prioritizeSearchHits"), "prioritizeSearchHits");
    const where = parseWhere(query.get("where"));

    const searchQuery = query.get("searchQuery") ?? undefined;

    // サービスへ渡す SearchParams を組み立て
    const params: SearchParams = {};
    if (typeof page === "number") params.page = page;
    if (typeof limit === "number") params.limit = limit;
    if (orderBy) params.orderBy = orderBy;
    if (searchQuery) params.searchQuery = searchQuery;
    if (searchFields) params.searchFields = searchFields;
    if (where) params.where = where;
    if (searchPriorityFields) params.searchPriorityFields = searchPriorityFields;
    if (typeof prioritizeSearchHits === "boolean") params.prioritizeSearchHits = prioritizeSearchHits;

    // ドメインサービスの search を実行し結果を JSON で返却
    const data = await service.search(params);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/[domain]/search failed:", error);
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof Error) {
      if (isDomainError(error)) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }

      // その他のエラーはメッセージがあれば 500 として返却
      if (error.message) {
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
    }

    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
