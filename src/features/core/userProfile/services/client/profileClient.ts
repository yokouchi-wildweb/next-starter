// src/features/core/userProfile/services/client/profileClient.ts
// ロールパラメータ付きのプロフィールAPIクライアント

import axios from "axios";
import type { SearchParams, PaginatedResult, WithOptions } from "@/lib/crud/types";
import { normalizeHttpError } from "@/lib/errors";

type ProfileRecord = Record<string, unknown>;

function buildBaseUrl(role: string) {
  return `/api/profile/${role}`;
}

function buildWithOptionsParams(options?: WithOptions): string {
  if (!options) return "";
  const params = new URLSearchParams();
  if (options.withRelations) params.set("withRelations", String(options.withRelations));
  if (options.withCount) params.set("withCount", "true");
  const str = params.toString();
  return str ? `?${str}` : "";
}

async function handleRequest<R>(fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

/**
 * プロフィールAPIクライアント
 * ロールをパラメータに取り、対応するプロフィールテーブルを操作する
 */
export const profileClient = {
  /** プロフィール一覧を取得 */
  list: (role: string, options?: WithOptions) =>
    handleRequest(async () =>
      (await axios.get<ProfileRecord[]>(`${buildBaseUrl(role)}${buildWithOptionsParams(options)}`)).data,
    ),

  /** プロフィールIDで単体取得 */
  get: (role: string, id: string) =>
    handleRequest(async () =>
      (await axios.get<ProfileRecord>(`${buildBaseUrl(role)}/${id}`)).data,
    ),

  /** プロフィールIDで更新 */
  update: (role: string, id: string, data: ProfileRecord) =>
    handleRequest(async () =>
      (await axios.patch<ProfileRecord>(`${buildBaseUrl(role)}/${id}`, { data })).data,
    ),

  /** プロフィール検索 */
  search: (role: string, params: SearchParams & WithOptions) =>
    handleRequest(async () => {
      const queryParams: Record<string, unknown> = { ...params };
      if (params.where) {
        queryParams.where = JSON.stringify(params.where);
      } else {
        delete queryParams.where;
      }
      return (await axios.get<PaginatedResult<ProfileRecord>>(
        `${buildBaseUrl(role)}/search`,
        { params: queryParams },
      )).data;
    }),

  /** プロフィールをupsert（userId競合時は更新） */
  upsert: (role: string, data: ProfileRecord) =>
    handleRequest(async () =>
      (await axios.put<ProfileRecord>(`${buildBaseUrl(role)}/upsert`, { data })).data,
    ),

  /** userIdでプロフィールを取得 */
  getByUserId: (role: string, userId: string) =>
    handleRequest(async () =>
      (await axios.get<ProfileRecord>(`${buildBaseUrl(role)}/by-user/${userId}`)).data,
    ),

  /** userIdでプロフィールを更新 */
  updateByUserId: (role: string, userId: string, data: ProfileRecord) =>
    handleRequest(async () =>
      (await axios.patch<ProfileRecord>(`${buildBaseUrl(role)}/by-user/${userId}`, { data })).data,
    ),
};
