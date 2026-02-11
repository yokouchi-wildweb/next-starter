// src/features/userTag/services/client/userTagClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { UserTag } from "@/features/core/userTag/entities";
import type {
  UserTagCreateFields,
  UserTagUpdateFields,
} from "@/features/core/userTag/entities/form";

export const userTagClient: ApiClient<
  UserTag,
  UserTagCreateFields,
  UserTagUpdateFields
> = createApiClient<
  UserTag,
  UserTagCreateFields,
  UserTagUpdateFields
>("/api/userTag");
