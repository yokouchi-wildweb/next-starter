// src/features/foo/hooks/useUpsertFoo.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { fooClient } from "../services/client/fooClient";
import type { Foo } from "../entities";
import type { FooCreateFields } from "../entities/form";

export const useUpsertFoo = () => {
  const upsert = fooClient.upsert;

  if (!upsert) {
    throw new Error("Fooのアップサート機能が利用できません");
  }

  return useUpsertDomain<Foo, FooCreateFields>(
    "fooes/upsert",
    upsert,
    "fooes",
  );
};
