// src/features/foo/hooks/useFoo.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { fooClient } from "../services/client/fooClient";
import type { Foo } from "../entities";

export const useFoo = (id?: string | null) =>
  useDomain<Foo | undefined>(
    id ? `foo:${id}` : null,
    () => fooClient.getById(id!) as Promise<Foo>,
  );
