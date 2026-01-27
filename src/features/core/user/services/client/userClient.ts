// src/features/user/services/client/userClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
import type { UserRoleType } from "@/features/core/user/constants/role";
import type { CreateUserInput, UpdateUserInput } from "../types";
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

export const userClient = {
  ...baseClient,
  changeStatus,
  changeRole,
  softDelete,
  hardDelete,
  updateMyProfile,
  sendEmailChangeVerification,
  confirmEmailChange,
};
