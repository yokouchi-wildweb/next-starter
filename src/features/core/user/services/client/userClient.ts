// src/features/user/services/client/userClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { User } from "@/features/core/user/entities";
import type { UserStatus } from "@/features/core/user/types";
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

export const userClient = {
  ...baseClient,
  changeStatus,
};
