// src/features/gachaMachine/services/client/gachaMachineClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { GachaMachine } from "@/features/gachaMachine/entities";
import type {
  GachaMachineCreateFields,
  GachaMachineUpdateFields,
} from "@/features/gachaMachine/entities/form";

export const gachaMachineClient: ApiClient<
  GachaMachine,
  GachaMachineCreateFields,
  GachaMachineUpdateFields
> = createApiClient<
  GachaMachine,
  GachaMachineCreateFields,
  GachaMachineUpdateFields
>("/api/gachaMachine");
