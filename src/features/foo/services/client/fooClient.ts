// src/features/foo/services/client/fooClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Foo } from "@/features/foo/entities";
import type {
  FooCreateFields,
  FooUpdateFields,
} from "@/features/foo/entities/form";

export const fooClient: ApiClient<
  Foo,
  FooCreateFields,
  FooUpdateFields
> = createApiClient<
  Foo,
  FooCreateFields,
  FooUpdateFields
>("/api/foo");
