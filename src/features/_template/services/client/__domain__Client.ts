// src/features/__domain__/services/client/__domain__Client.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { __Domain__ } from "@/features/__domain__/entities";
import type {
  __Domain__CreateFields,
  __Domain__UpdateFields,
} from "@/features/__domain__/entities/form";

export const __domain__Client: ApiClient<
  __Domain__,
  __Domain__CreateFields,
  __Domain__UpdateFields
> = createApiClient<
  __Domain__,
  __Domain__CreateFields,
  __Domain__UpdateFields
>("/api/__domain__");
