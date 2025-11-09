// src/features/title/services/client/titleClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Title } from "@/features/title/entities";
import type { TitleCreateFields } from "@/features/title/entities/form";

export const titleClient: ApiClient<Title, TitleCreateFields> = createApiClient<Title, TitleCreateFields>("/api/title");
