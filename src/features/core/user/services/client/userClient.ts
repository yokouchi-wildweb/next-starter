// src/features/user/services/client/userClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { User } from "@/features/core/user/entities";
import type { CreateUserInput, UpdateUserInput } from "../types";

export const userClient: ApiClient<User, CreateUserInput, UpdateUserInput> =
  createApiClient<User, CreateUserInput, UpdateUserInput>("/api/user");
