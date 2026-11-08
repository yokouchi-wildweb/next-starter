// src/lib/crud/client/apiClientFactory.ts

import axios, { type AxiosRequestConfig } from "axios";
// 呼び出しの設定の defaultTimeout(型の拡張)。既定のタイムアウトの持ち主: src/lib/httpDefaults
import type {} from "@/lib/httpDefaults";
import type {
  ApiClient,
  SearchParams,
  CountParams,
  CountResult,
  PaginatedResult,
  UpsertOptions,
  BulkUpsertOptions,
  BulkUpsertResult,
  BulkUpdateRecord,
  BulkUpdateResult,
  BulkRelationResult,
  ReplaceByQueryOptions,
  DuplicateOptions,
  WhereExpr,
  WithOptions,
} from "../types";
import type { CrudAction } from "./events";
import { emitCrudEvent } from "./events";
import { normalizeHttpError, type HttpError } from "@/lib/errors";

let errorHandler = (error: HttpError) => {
  if (error.status && error.status >= 500) {
    console.error("API request error", error.status, error.message);
  }
};

export function setApiErrorHandler(handler: (error: HttpError) => void) {
  errorHandler = handler;
}

function handleError(error: HttpError): never {
  errorHandler(error);
  throw error;
}

async function handleRequest<R>(action: CrudAction, fn: () => Promise<R>): Promise<R> {
  try {
    const result = await fn();
    emitCrudEvent({ action, payload: result, success: true });
    return result;
  } catch (error) {
    const normalized = normalizeHttpError(error);
    emitCrudEvent({ action, success: false, error: normalized });
    handleError(normalized);
  }
}

/**
 * 通常の操作の待ち時間の上限（1 リクエストごとに渡す。axios.defaults は他の通信にも効くので触らない）。
 * bulk*・replaceByQuery・duplicate は件数やファイルの数だけ時間がかかるので上限を付けない
 */
const NORMAL_REQUEST = { timeout: 60_000 };

/**
 * 上限を付けない操作(bulk*・replaceByQuery・duplicate)。アプリ全体の既定のタイムアウト(src/lib/httpDefaults)も外す
 */
const UNBOUNDED_REQUEST: AxiosRequestConfig = { defaultTimeout: false };

/**
 * WithOptionsをクエリパラメータ文字列に変換
 */
function buildWithOptionsParams(options?: WithOptions): string {
  if (!options) return "";
  const params = new URLSearchParams();
  if (options.withRelations) params.set("withRelations", String(options.withRelations));
  if (options.withCount) params.set("withCount", "true");
  if (options.hasManyLimit) params.set("hasManyLimit", String(options.hasManyLimit));
  const str = params.toString();
  return str ? `?${str}` : "";
}

/**
 * search のクエリを組み立てる（axios のブラケット直列化だとルートが読めない値を、ルートが読む形にする）
 * - where / relationWhere / orderBy / searchRank の spec: JSON
 * - searchFields: カンマ区切り
 * - 未指定・空の orderBy / searchFields は送らない
 */
function buildSearchQueryParams(params: SearchParams & WithOptions): Record<string, unknown> {
  const queryParams: Record<string, unknown> = { ...params };

  if (params.where) {
    queryParams.where = JSON.stringify(params.where);
  } else {
    delete queryParams.where;
  }

  if (params.relationWhere) {
    queryParams.relationWhere = JSON.stringify(params.relationWhere);
  } else {
    delete queryParams.relationWhere;
  }

  if (params.orderBy?.length) {
    queryParams.orderBy = JSON.stringify(params.orderBy);
  } else {
    delete queryParams.orderBy;
  }

  if (params.searchFields?.length) {
    queryParams.searchFields = params.searchFields.join(",");
  } else {
    delete queryParams.searchFields;
  }

  if (params.searchRank === undefined) {
    delete queryParams.searchRank;
  } else if (typeof params.searchRank === "object") {
    queryParams.searchRank = JSON.stringify(params.searchRank);
  }

  return queryParams;
}

export function createApiClient<T, CreateData = Partial<T>, UpdateData = Partial<T>>(
  baseUrl: string,
): ApiClient<T, CreateData, UpdateData> {
  return {
    getAll: (options?: WithOptions) =>
      handleRequest("getAll", async () => (await axios.get<T[]>(`${baseUrl}${buildWithOptionsParams(options)}`, NORMAL_REQUEST)).data),
    getById: (id, options?: WithOptions) =>
      handleRequest("getById", async () => (await axios.get<T>(`${baseUrl}/${id}${buildWithOptionsParams(options)}`, NORMAL_REQUEST)).data),
    create: (data: CreateData) =>
      handleRequest("create", async () => (await axios.post<T>(baseUrl, { data }, NORMAL_REQUEST)).data),
    update: (id, data: UpdateData) =>
      handleRequest("update", async () => (await axios.put<T>(`${baseUrl}/${id}`, { data }, NORMAL_REQUEST)).data),
    delete: (id) =>
      handleRequest("delete", async () => {
        await axios.delete(`${baseUrl}/${id}`, NORMAL_REQUEST);
        return undefined;
      }),
    search: (params: SearchParams & WithOptions) =>
      handleRequest("search", async () => {
        return (await axios.get<PaginatedResult<T>>(`${baseUrl}/search`, { params: buildSearchQueryParams(params), ...NORMAL_REQUEST })).data;
      }),
    bulkDeleteByIds: (ids) =>
      handleRequest("bulkDeleteByIds", async () => {
        await axios.post(`${baseUrl}/bulk/delete-by-ids`, { ids }, UNBOUNDED_REQUEST);
        return undefined;
      }),
    bulkDeleteByQuery: (where: WhereExpr) =>
      handleRequest("bulkDeleteByQuery", async () => {
        await axios.post(`${baseUrl}/bulk/delete-by-query`, { where }, UNBOUNDED_REQUEST);
        return undefined;
      }),
    upsert: (data: CreateData, options?: UpsertOptions<CreateData>) =>
      handleRequest(
        "upsert",
        async () => (await axios.put<T>(`${baseUrl}/upsert`, { data, options }, NORMAL_REQUEST)).data,
      ),
    bulkUpsert: (records: CreateData[], options?: BulkUpsertOptions<CreateData>) =>
      handleRequest(
        "bulkUpsert",
        async () =>
          (await axios.post<BulkUpsertResult<T>>(`${baseUrl}/bulk/upsert`, { records, options }, UNBOUNDED_REQUEST)).data,
      ),
    replaceByQuery: (where: WhereExpr, records: CreateData[], options?: ReplaceByQueryOptions) =>
      handleRequest(
        "replaceByQuery",
        async () =>
          (await axios.post<T[]>(`${baseUrl}/bulk/replace-by-query`, { where, records, options }, UNBOUNDED_REQUEST)).data,
      ),
    bulkUpdate: (records: BulkUpdateRecord<UpdateData>[]) =>
      handleRequest(
        "bulkUpdate",
        async () =>
          (await axios.post<BulkUpdateResult<T>>(`${baseUrl}/bulk/update`, { records }, UNBOUNDED_REQUEST)).data,
      ),
    bulkUpdateByIds: (ids: string[], data: UpdateData) =>
      handleRequest(
        "bulkUpdateByIds",
        async () =>
          (await axios.post<{ count: number }>(`${baseUrl}/bulk/update-by-ids`, { ids, data }, UNBOUNDED_REQUEST)).data,
      ),
    bulkAddRelation: (field: string, ids: string[], targetIds: string[]) =>
      handleRequest(
        "bulkAddRelation",
        async () =>
          (await axios.post<BulkRelationResult>(`${baseUrl}/bulk/add-relation`, { field, ids, targetIds }, UNBOUNDED_REQUEST)).data,
      ),
    bulkRemoveRelation: (field: string, ids: string[], targetIds: string[]) =>
      handleRequest(
        "bulkRemoveRelation",
        async () =>
          (await axios.post<BulkRelationResult>(`${baseUrl}/bulk/remove-relation`, { field, ids, targetIds }, UNBOUNDED_REQUEST)).data,
      ),
    duplicate: (id: string, options?: DuplicateOptions) =>
      handleRequest(
        "duplicate",
        async () =>
          (await axios.post<T>(`${baseUrl}/${id}/duplicate`, options?.name !== undefined ? { name: options.name } : undefined, UNBOUNDED_REQUEST)).data,
      ),
    restore: (id: string) =>
      handleRequest(
        "restore",
        async () => (await axios.post<T>(`${baseUrl}/${id}/restore`, undefined, NORMAL_REQUEST)).data,
      ),
    hardDelete: (id: string) =>
      handleRequest("hardDelete", async () => {
        await axios.delete(`${baseUrl}/${id}/hard-delete`, NORMAL_REQUEST);
        return undefined;
      }),
    reorder: (id: string, afterItemId: string | null) =>
      handleRequest("reorder", async () => (await axios.post<T>(`${baseUrl}/${id}/reorder`, { afterItemId }, NORMAL_REQUEST)).data),
    searchForSorting: (params: SearchParams) =>
      handleRequest("searchForSorting", async () => (await axios.post<PaginatedResult<T>>(`${baseUrl}/search-for-sorting`, params, NORMAL_REQUEST)).data),
    count: (params: CountParams) =>
      handleRequest("count", async () => (await axios.post<CountResult>(`${baseUrl}/count`, params, NORMAL_REQUEST)).data),
  };
}
