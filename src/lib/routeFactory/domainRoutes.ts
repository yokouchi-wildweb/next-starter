// src/lib/routeFactory/domainRoutes.ts
//
// 汎用ドメイン CRUD オペレーションの単一ソース定義と、固定ドメイン版ファクトリ。
//
// 目的:
// - /api/[domain]/** の汎用ルートと、静的フォルダ配下で同オペレーションを再公開する
//   固定ドメインルートが「完全に同一のハンドラ実装・認可」を共有するようにする。
// - Next.js App Router の静的セグメントが動的 [domain] をシャドーする問題
//   （例: /api/setting/setup が存在すると /api/setting/<id> や /api/setting/search 等が
//   /api/[domain]/** にフォールバックせず 404）への汎用対策。
//
// 使い方（静的フォルダを持つドメイン側 — 使用オペレーションだけ mirror すればよい）:
//   // src/app/api/<domain>/route.ts
//   export const { GET, POST } = createDomainCollectionRouteFor("<domain>");
//   // src/app/api/<domain>/[id]/route.ts
//   export const { GET, PUT, DELETE } = createDomainIdRouteFor("<domain>");
//   // src/app/api/<domain>/search/route.ts
//   export const { GET } = createDomainSearchRouteFor("<domain>");
//   // ...（各ファクトリは下部を参照）
//
// 認可・URLスキーム・SSR 直サービス経路は一切変えない。domain を params から読むか
// 固定値で解決するかだけが違う（createDomainRoute の fixedDomain 経由）。

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { createDomainIdRoute, createDomainRoute } from "./createDomainRoute";
import type { DomainRouteConfig, DomainRouteContext } from "./createDomainRoute";
import {
  BadRequestError,
  parseBooleanFlag,
  parseOrderBy,
  parsePositiveInteger,
  parseRelationWhere,
  parseSearchFields,
  parseSearchPriorityFields,
  parseWhere,
  parseWithRelations,
} from "./domainQuery";
import type { SearchParams, WhereExpr, WithOptions } from "@/lib/crud";
import type { CountParams } from "@/lib/crud/types";
import { DomainError } from "@/lib/errors";

type DomainParams = { domain: string };
type DomainIdParams = { domain: string; id: string };

/**
 * 汎用ドメインオペレーションの定義。
 * config（fixedDomain を除く）と handler をペアで保持し、
 * 汎用ルートと固定ドメインルートの双方から同一の実体を組み立てられるようにする。
 */
type DomainOperation<TParams extends DomainParams> = {
  config: Omit<DomainRouteConfig<any>, "fixedDomain">;
  handler: (
    req: NextRequest,
    ctx: DomainRouteContext<any, TParams>,
  ) => Promise<unknown> | unknown;
};

// ============================================================================
// オペレーション定義（単一ソース）
// ============================================================================

// ----- コレクション（/api/<domain>） -----

/** GET /api/<domain> : 一覧取得 */
export const listOperation: DomainOperation<DomainParams> = {
  config: { operation: "GET /api/[domain]", crudOp: "list", operationType: "read" },
  handler: (req, { service }) => {
    const query = req.nextUrl.searchParams;
    const options: WithOptions = {};
    const withRelations = parseWithRelations(query.get("withRelations"));
    const withCount = parseBooleanFlag(query.get("withCount"), "withCount");
    const limit = parsePositiveInteger(query.get("limit"), "limit");
    const hasManyLimit = parsePositiveInteger(query.get("hasManyLimit"), "hasManyLimit");
    if (withRelations) options.withRelations = withRelations;
    if (withCount) options.withCount = withCount;
    if (typeof limit === "number") options.limit = limit;
    if (typeof hasManyLimit === "number") options.hasManyLimit = hasManyLimit;
    return service.list(options);
  },
};

/** POST /api/<domain> : 新規作成 */
export const createOperation: DomainOperation<DomainParams> = {
  config: { operation: "POST /api/[domain]", crudOp: "create", operationType: "write" },
  handler: async (req, { service }) => {
    const { data } = await req.json();
    return service.create(data);
  },
};

// ----- ID（/api/<domain>/[id]） -----

/** GET /api/<domain>/[id] : ID指定で単一取得 */
export const getOperation: DomainOperation<DomainIdParams> = {
  config: { operation: "GET /api/[domain]/[id]", crudOp: "get", operationType: "read" },
  handler: (req, { service, params }) => {
    const query = req.nextUrl.searchParams;
    const options: WithOptions = {};
    const withRelations = parseWithRelations(query.get("withRelations"));
    const withCount = parseBooleanFlag(query.get("withCount"), "withCount");
    const hasManyLimit = parsePositiveInteger(query.get("hasManyLimit"), "hasManyLimit");
    if (withRelations) options.withRelations = withRelations;
    if (withCount) options.withCount = withCount;
    if (typeof hasManyLimit === "number") options.hasManyLimit = hasManyLimit;
    return service.get(params.id, options);
  },
};

/** PUT /api/<domain>/[id] : 更新 */
export const updateOperation: DomainOperation<DomainIdParams> = {
  config: { operation: "PUT /api/[domain]/[id]", crudOp: "update", operationType: "write" },
  handler: async (req, { service, params }) => {
    const { data } = await req.json();
    return service.update(params.id, data);
  },
};

/** DELETE /api/<domain>/[id] : ソフト削除 */
export const removeOperation: DomainOperation<DomainIdParams> = {
  config: { operation: "DELETE /api/[domain]/[id]", crudOp: "remove", operationType: "write" },
  handler: async (_req, { service, params }) => {
    await service.remove(params.id);
    return { success: true };
  },
};

// ----- 検索 / 集計 -----

/** GET /api/<domain>/search : 検索 */
export const searchOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "GET /api/[domain]/search",
    crudOp: "search",
    operationType: "read",
    supports: "search",
  },
  handler: (req, { service }) => {
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
      const relationWhere = parseRelationWhere(query.get("relationWhere"));
      const searchQuery = query.get("searchQuery") ?? undefined;
      const withRelations = parseWithRelations(query.get("withRelations"));
      const withCount = parseBooleanFlag(query.get("withCount"), "withCount");
      const hasManyLimit = parsePositiveInteger(query.get("hasManyLimit"), "hasManyLimit");

      const searchParams: SearchParams & WithOptions = {};
      if (typeof page === "number") searchParams.page = page;
      if (typeof limit === "number") searchParams.limit = limit;
      if (orderBy) searchParams.orderBy = orderBy;
      if (searchQuery) searchParams.searchQuery = searchQuery;
      if (searchFields) searchParams.searchFields = searchFields;
      if (where) searchParams.where = where;
      if (relationWhere) searchParams.relationWhere = relationWhere;
      if (searchPriorityFields) searchParams.searchPriorityFields = searchPriorityFields;
      if (typeof prioritizeSearchHits === "boolean")
        searchParams.prioritizeSearchHits = prioritizeSearchHits;
      if (withRelations) searchParams.withRelations = withRelations;
      if (withCount) searchParams.withCount = withCount;
      if (typeof hasManyLimit === "number") searchParams.hasManyLimit = hasManyLimit;

      return service.search(searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      throw error;
    }
  },
};

/** POST /api/<domain>/search-for-sorting : ソート画面用検索（NULL の sort_order を自動初期化） */
export const searchForSortingOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "POST /api/[domain]/search-for-sorting",
    crudOp: "searchForSorting",
    operationType: "write", // 副作用（NULL初期化）があるため write
    supports: "searchForSorting",
  },
  handler: async (req, { service }) => {
    const body = await req.json();
    const searchParams: SearchParams = body ?? {};
    return service.searchForSorting(searchParams);
  },
};

/** POST /api/<domain>/count : 件数取得 */
export const countOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "POST /api/[domain]/count",
    crudOp: "count",
    operationType: "read",
    supports: "count",
  },
  handler: async (req, { service }) => {
    const body = await req.json();
    const countParams: CountParams = {};
    if (body.where) countParams.where = body.where;
    if (body.searchQuery) countParams.searchQuery = body.searchQuery;
    if (body.searchFields) countParams.searchFields = body.searchFields;
    if (body.relationWhere) countParams.relationWhere = body.relationWhere;
    return service.count(countParams);
  },
};

/** PUT /api/<domain>/upsert : 既存更新 or 新規作成 */
export const upsertOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "PUT /api/[domain]/upsert",
    crudOp: "upsert",
    operationType: "write",
    supports: "upsert",
  },
  handler: async (req, { service }) => {
    const { data, options } = await req.json();
    return service.upsert(data, options);
  },
};

// ----- ID 系サブオペレーション -----

// duplicate は取得済みレコードを create に渡す経路で、ドメインの create スキーマ検証を
// 通らないため、ユーザー入力の name はここで検証する
const duplicateBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});

/** POST /api/<domain>/[id]/duplicate : 複製 */
export const duplicateOperation: DomainOperation<DomainIdParams> = {
  config: {
    operation: "POST /api/[domain]/[id]/duplicate",
    crudOp: "duplicate",
    operationType: "write",
    supports: "duplicate",
  },
  handler: async (req, { service, params }) => {
    // 既存クライアントは body なしで呼ぶため、空 body は許容する
    const body = await req.json().catch(() => null);
    const parsed = duplicateBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new DomainError("name は1〜255文字の文字列で指定してください", { status: 400 });
    }
    return service.duplicate(params.id, parsed.data);
  },
};

/** DELETE /api/<domain>/[id]/hard-delete : 物理削除 */
export const hardDeleteOperation: DomainOperation<DomainIdParams> = {
  config: {
    operation: "DELETE /api/[domain]/[id]/hard-delete",
    crudOp: "hardDelete",
    operationType: "write",
    supports: "hardDelete",
  },
  handler: async (_req, { service, params }) => {
    await service.hardDelete(params.id);
    return new NextResponse(null, { status: 204 });
  },
};

/** POST /api/<domain>/[id]/reorder : 並び順変更 */
export const reorderOperation: DomainOperation<DomainIdParams> = {
  config: {
    operation: "POST /api/[domain]/[id]/reorder",
    crudOp: "reorder",
    operationType: "write",
    supports: "reorder",
  },
  handler: async (req, { service, params }) => {
    const body = await req.json();
    const afterItemId = body?.afterItemId ?? null;
    return service.reorder(params.id, afterItemId);
  },
};

/** POST /api/<domain>/[id]/restore : ソフト削除の復旧 */
export const restoreOperation: DomainOperation<DomainIdParams> = {
  config: {
    operation: "POST /api/[domain]/[id]/restore",
    crudOp: "restore",
    operationType: "write",
    supports: "restore",
  },
  handler: async (_req, { service, params }) => {
    return service.restore(params.id);
  },
};

// ----- バルク -----

/** POST /api/<domain>/bulk/delete-by-ids : ID指定の複数削除 */
export const bulkDeleteByIdsOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "POST /api/[domain]/bulk/delete-by-ids",
    crudOp: "bulkDeleteByIds",
    operationType: "write",
    supports: "bulkDeleteByIds",
  },
  handler: async (req, { service }) => {
    const { ids } = await req.json();
    await service.bulkDeleteByIds(ids);
    return { success: true };
  },
};

/** POST /api/<domain>/bulk/delete-by-query : クエリ条件で一括削除 */
export const bulkDeleteByQueryOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "POST /api/[domain]/bulk/delete-by-query",
    crudOp: "bulkDeleteByQuery",
    operationType: "write",
    supports: "bulkDeleteByQuery",
  },
  handler: async (req, { service }) => {
    const body = await req.json();
    const where = body?.where as WhereExpr | undefined;
    if (!where) {
      return NextResponse.json({ message: "where パラメータは必須です" }, { status: 400 });
    }
    await service.bulkDeleteByQuery(where);
    return { success: true };
  },
};

/** POST /api/<domain>/bulk/update : 複数レコードの一括更新 */
export const bulkUpdateOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "POST /api/[domain]/bulk/update",
    crudOp: "bulkUpdate",
    operationType: "write",
    supports: "bulkUpdate",
  },
  handler: async (req, { service }) => {
    const { records } = await req.json();
    return service.bulkUpdate(records);
  },
};

/** POST /api/<domain>/bulk/update-by-ids : ID指定の複数レコード一括更新（同一データ） */
export const bulkUpdateByIdsOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "POST /api/[domain]/bulk/update-by-ids",
    crudOp: "bulkUpdateByIds",
    operationType: "write",
    supports: "bulkUpdateByIds",
  },
  handler: async (req, { service }) => {
    const { ids, data } = await req.json();
    return service.bulkUpdateByIds(ids, data);
  },
};

/** POST /api/<domain>/bulk/upsert : 複数レコードの一括アップサート */
export const bulkUpsertOperation: DomainOperation<DomainParams> = {
  config: {
    operation: "POST /api/[domain]/bulk/upsert",
    crudOp: "bulkUpsert",
    operationType: "write",
    supports: "bulkUpsert",
  },
  handler: async (req, { service }) => {
    const { records, options } = await req.json();
    return service.bulkUpsert(records, options);
  },
};

// ============================================================================
// 汎用ルート組み立てヘルパー（/api/[domain]/** の各 route.ts が使用）
// ============================================================================

/** ドメイン param からドメインを解決する汎用ルート（コレクション系）を組み立てる */
export function buildDomainRoute(op: DomainOperation<DomainParams>) {
  return createDomainRoute<any, DomainParams>(op.config, op.handler);
}

/** ドメイン param からドメインを解決する汎用ルート（ID系）を組み立てる */
export function buildDomainIdRoute(op: DomainOperation<DomainIdParams>) {
  return createDomainIdRoute<any>(op.config, op.handler);
}

// ============================================================================
// 固定ドメインファクトリ（静的フォルダ配下の mirror route.ts が使用）
// ============================================================================

const fixedDomainRoute = (op: DomainOperation<DomainParams>, domain: string) =>
  createDomainRoute<any, DomainParams>({ ...op.config, fixedDomain: domain }, op.handler);

const fixedDomainIdRoute = (op: DomainOperation<DomainIdParams>, domain: string) =>
  createDomainIdRoute<any>({ ...op.config, fixedDomain: domain }, op.handler);

/** /api/<domain>（コレクション: list + create） */
export function createDomainCollectionRouteFor(domain: string) {
  return {
    GET: fixedDomainRoute(listOperation, domain),
    POST: fixedDomainRoute(createOperation, domain),
  };
}

/** /api/<domain>/[id]（get + update + remove） */
export function createDomainIdRouteFor(domain: string) {
  return {
    GET: fixedDomainIdRoute(getOperation, domain),
    PUT: fixedDomainIdRoute(updateOperation, domain),
    DELETE: fixedDomainIdRoute(removeOperation, domain),
  };
}

/** /api/<domain>/search */
export function createDomainSearchRouteFor(domain: string) {
  return { GET: fixedDomainRoute(searchOperation, domain) };
}

/** /api/<domain>/search-for-sorting */
export function createDomainSearchForSortingRouteFor(domain: string) {
  return { POST: fixedDomainRoute(searchForSortingOperation, domain) };
}

/** /api/<domain>/count */
export function createDomainCountRouteFor(domain: string) {
  return { POST: fixedDomainRoute(countOperation, domain) };
}

/** /api/<domain>/upsert */
export function createDomainUpsertRouteFor(domain: string) {
  return { PUT: fixedDomainRoute(upsertOperation, domain) };
}

/** /api/<domain>/[id]/duplicate */
export function createDomainDuplicateRouteFor(domain: string) {
  return { POST: fixedDomainIdRoute(duplicateOperation, domain) };
}

/** /api/<domain>/[id]/hard-delete */
export function createDomainHardDeleteRouteFor(domain: string) {
  return { DELETE: fixedDomainIdRoute(hardDeleteOperation, domain) };
}

/** /api/<domain>/[id]/reorder */
export function createDomainReorderRouteFor(domain: string) {
  return { POST: fixedDomainIdRoute(reorderOperation, domain) };
}

/** /api/<domain>/[id]/restore */
export function createDomainRestoreRouteFor(domain: string) {
  return { POST: fixedDomainIdRoute(restoreOperation, domain) };
}

/** /api/<domain>/bulk/delete-by-ids */
export function createDomainBulkDeleteByIdsRouteFor(domain: string) {
  return { POST: fixedDomainRoute(bulkDeleteByIdsOperation, domain) };
}

/** /api/<domain>/bulk/delete-by-query */
export function createDomainBulkDeleteByQueryRouteFor(domain: string) {
  return { POST: fixedDomainRoute(bulkDeleteByQueryOperation, domain) };
}

/** /api/<domain>/bulk/update */
export function createDomainBulkUpdateRouteFor(domain: string) {
  return { POST: fixedDomainRoute(bulkUpdateOperation, domain) };
}

/** /api/<domain>/bulk/update-by-ids */
export function createDomainBulkUpdateByIdsRouteFor(domain: string) {
  return { POST: fixedDomainRoute(bulkUpdateByIdsOperation, domain) };
}

/** /api/<domain>/bulk/upsert */
export function createDomainBulkUpsertRouteFor(domain: string) {
  return { POST: fixedDomainRoute(bulkUpsertOperation, domain) };
}
