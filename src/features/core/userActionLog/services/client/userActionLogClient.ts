// src/features/core/userActionLog/services/client/userActionLogClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { UserActionLog } from "@/features/core/userActionLog/entities";

const baseClient = createApiClient<UserActionLog>("/api/userActionLog");

// searchメソッドが必須であることを保証する型
type UserActionLogClient = ApiClient<UserActionLog> & {
  search: NonNullable<ApiClient<UserActionLog>["search"]>;
};

export const userActionLogClient = baseClient as UserActionLogClient;
