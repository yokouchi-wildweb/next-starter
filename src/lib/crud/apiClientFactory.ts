// src/lib/crud/apiClientFactory.ts

import axios from "axios";
import type {
  ApiClient,
  SearchParams,
  PaginatedResult,
  UpsertOptions,
  BulkUpsertOptions,
  BulkUpsertResult,
  WhereExpr,
} from "./types";
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

export function createApiClient<T, CreateData = Partial<T>, UpdateData = Partial<T>>(
  baseUrl: string,
): ApiClient<T, CreateData, UpdateData> {
  return {
    getAll: () => handleRequest("getAll", async () => (await axios.get<T[]>(baseUrl)).data),
    getById: (id) => handleRequest("getById", async () => (await axios.get<T>(`${baseUrl}/${id}`)).data),
    create: (data: CreateData) =>
      handleRequest("create", async () => (await axios.post<T>(baseUrl, { data })).data),
    update: (id, data: UpdateData) =>
      handleRequest("update", async () => (await axios.put<T>(`${baseUrl}/${id}`, { data })).data),
    delete: (id) =>
      handleRequest("delete", async () => {
        await axios.delete(`${baseUrl}/${id}`);
        return undefined;
      }),
    search: (params: SearchParams) =>
      handleRequest("search", async () => {
        const queryParams: Record<string, unknown> = { ...params };

        if (params.where) {
          queryParams.where = JSON.stringify(params.where);
        } else {
          delete queryParams.where;
        }

        return (await axios.get<PaginatedResult<T>>(`${baseUrl}/search`, { params: queryParams })).data;
      }),
    bulkDeleteByIds: (ids) =>
      handleRequest("bulkDeleteByIds", async () => {
        await axios.post(`${baseUrl}/bulk/delete-by-ids`, { ids });
        return undefined;
      }),
    bulkDeleteByQuery: (where: WhereExpr) =>
      handleRequest("bulkDeleteByQuery", async () => {
        await axios.post(`${baseUrl}/bulk/delete-by-query`, { where });
        return undefined;
      }),
    upsert: (data: CreateData, options?: UpsertOptions<CreateData>) =>
      handleRequest(
        "upsert",
        async () => (await axios.put<T>(`${baseUrl}/upsert`, { data, options })).data,
      ),
    bulkUpsert: (records: CreateData[], options?: BulkUpsertOptions<CreateData>) =>
      handleRequest(
        "bulkUpsert",
        async () =>
          (await axios.post<BulkUpsertResult<T>>(`${baseUrl}/bulk/upsert`, { records, options })).data,
      ),
    duplicate: (id: string) =>
      handleRequest(
        "duplicate",
        async () => (await axios.post<T>(`${baseUrl}/${id}/duplicate`)).data,
      ),
    restore: (id: string) =>
      handleRequest(
        "restore",
        async () => (await axios.post<T>(`${baseUrl}/${id}/restore`)).data,
      ),
    hardDelete: (id: string) =>
      handleRequest("hardDelete", async () => {
        await axios.delete(`${baseUrl}/${id}/hard-delete`);
        return undefined;
      }),
  };
}
