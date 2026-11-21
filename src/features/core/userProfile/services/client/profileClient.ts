// src/features/core/userProfile/services/client/profileClient.ts
// ロールパラメータ付きのプロフィールAPIクライアント
// 共通の CRUD は crud の createApiClient(ロールごとの /api/profile/<role>)に任せ、
// プロフィールにしかない操作(userId で取得・更新・削除)だけをここに書く

import axios from "axios";
import { createApiClient } from "@/lib/crud";
import type { ApiClient, SearchParams, WithOptions } from "@/lib/crud";
import { normalizeHttpError } from "@/lib/errors";

type ProfileRecord = Record<string, unknown>;

function buildBaseUrl(role: string) {
  return `/api/profile/${role}`;
}

/** ロールのプロフィールテーブルを扱う共通の CRUD クライアント */
function crudOf(role: string): ApiClient<ProfileRecord> {
  return createApiClient<ProfileRecord>(buildBaseUrl(role));
}

/**
 * プロフィールAPIクライアント
 * ロールをパラメータに取り、対応するプロフィールテーブルを操作する
 */
export const profileClient = {
  /** プロフィール一覧を取得 */
  getAll: (role: string, options?: WithOptions) => crudOf(role).getAll(options),

  /** プロフィールIDで単体取得 */
  get: (role: string, id: string) => crudOf(role).get(id),

  /** プロフィールIDで更新 */
  update: (role: string, id: string, data: ProfileRecord) => crudOf(role).update(id, data),

  /** プロフィール検索 */
  search: (role: string, params: SearchParams & WithOptions) => crudOf(role).search(params),

  /** プロフィールをupsert（userId競合時は更新） */
  upsert: (role: string, data: ProfileRecord) => crudOf(role).upsert(data),

  /** プロフィールIDで削除 */
  delete: (role: string, id: string) => crudOf(role).delete(id),

  /** userIdでプロフィールを取得 */
  getByUserId: async (role: string, userId: string) => {
    try {
      return (await axios.get<ProfileRecord>(`${buildBaseUrl(role)}/by-user/${userId}`)).data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },

  /** userIdでプロフィールを更新 */
  updateByUserId: async (role: string, userId: string, data: ProfileRecord) => {
    try {
      return (await axios.patch<ProfileRecord>(`${buildBaseUrl(role)}/by-user/${userId}`, { data })).data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },

  /** userIdでプロフィールを削除 */
  deleteByUserId: async (role: string, userId: string) => {
    try {
      return (await axios.delete<{ success: boolean }>(`${buildBaseUrl(role)}/by-user/${userId}`)).data;
    } catch (error) {
      throw normalizeHttpError(error);
    }
  },
};
