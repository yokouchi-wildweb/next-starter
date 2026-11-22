// src/domains/userTag/services/client/userTagClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { UserTag } from "@/domains/core/userTag/entities";
import type {
  UserTagCreateFields,
  UserTagUpdateFields,
} from "@/domains/core/userTag/entities/form";

export const userTagClient: ApiClient<
  UserTag,
  UserTagCreateFields,
  UserTagUpdateFields
> = createApiClient<
  UserTag,
  UserTagCreateFields,
  UserTagUpdateFields
>("/api/userTag");
