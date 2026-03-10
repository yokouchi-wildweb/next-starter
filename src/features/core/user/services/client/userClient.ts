// src/features/user/services/client/userClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import type { UserRoleType } from "@/features/core/user/constants/role";
import type { CreateUserInput, UpdateUserInput } from "../types";
import type { SearchParams, PaginatedResult, WithOptions, WhereExpr } from "@/lib/crud/types";
import { normalizeHttpError } from "@/lib/errors";
import axios from "axios";

const baseClient: ApiClient<User, CreateUserInput, UpdateUserInput> =
  createApiClient<User, CreateUserInput, UpdateUserInput>("/api/user");

export type ChangeStatusInput = {
  status: UserStatus;
  reason?: string;
};

async function changeStatus(userId: string, data: ChangeStatusInput): Promise<User> {
  const response = await axios.patch<User>(`/api/admin/user/${userId}/status`, data);
  return response.data;
}

export type ChangeRoleInput = {
  role: UserRoleType;
  reason?: string;
  deleteOldProfile?: boolean;
};

async function changeRole(userId: string, data: ChangeRoleInput): Promise<User> {
  const response = await axios.patch<User>(`/api/admin/user/${userId}/role`, data);
  return response.data;
}

export type SoftDeleteInput = {
  reason?: string;
};

async function softDelete(userId: string, data?: SoftDeleteInput): Promise<void> {
  await axios.post(`/api/admin/user/${userId}/delete`, data ?? {});
}

export type HardDeleteInput = {
  reason?: string;
};

async function hardDelete(userId: string, data?: HardDeleteInput): Promise<void> {
  await axios.delete(`/api/admin/user/${userId}/hard-delete`, { data: data ?? {} });
}

export type UpdateMyProfileInput = {
  name: string;
  avatarUrl?: string | null;
  profileData?: Record<string, unknown>;
};

async function updateMyProfile(data: UpdateMyProfileInput): Promise<User> {
  const response = await axios.patch<User>("/api/me/profile", data);
  return response.data;
}

export type SendEmailChangeVerificationInput = {
  newEmail: string;
};

async function sendEmailChangeVerification(data: SendEmailChangeVerificationInput): Promise<void> {
  await axios.post("/api/me/email/send-verification", data);
}

export type ConfirmEmailChangeResponse = {
  success: boolean;
  email: string;
};

async function confirmEmailChange(): Promise<ConfirmEmailChangeResponse> {
  const response = await axios.post<ConfirmEmailChangeResponse>("/api/me/email/confirm", {});
  return response.data;
}

export type SearchWithProfileClientParams = SearchParams & WithOptions & {
  /** プロフィールフィールドの構造化フィルタ（WhereExpr DSL） */
  profileWhere?: WhereExpr;
};

/**
 * ユーザー + プロフィール横断検索
 * role で指定したプロフィールの searchFields も含めてキーワード検索する。
 * profileWhere でプロフィールフィールドの構造化フィルタも可能。
 */
async function searchWithProfile(
  role: string,
  params: SearchWithProfileClientParams,
): Promise<PaginatedResult<User>> {
  try {
    const { profileWhere, ...rest } = params;
    const queryParams: Record<string, unknown> = { ...rest, role };
    if (params.where) {
      queryParams.where = JSON.stringify(params.where);
    } else {
      delete queryParams.where;
    }
    if (profileWhere) {
      queryParams.profileWhere = JSON.stringify(profileWhere);
    }
    return (
      await axios.get<PaginatedResult<User>>(
        "/api/admin/user/search-with-profile",
        { params: queryParams },
      )
    ).data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}

export const userClient = {
  ...baseClient,
  changeStatus,
  changeRole,
  softDelete,
  hardDelete,
  updateMyProfile,
  sendEmailChangeVerification,
  confirmEmailChange,
  searchWithProfile,
};
