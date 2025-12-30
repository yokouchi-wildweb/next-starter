// src/features/foo/hooks/useSearchFoo.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { fooClient } from "../services/client/fooClient";
import type { Foo } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type FooSearchParams = typeof fooClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchFoo = (params: FooSearchParams) => {
  const search = fooClient.search;

  if (!search) {
    throw new Error("Fooの検索機能が利用できません");
  }

  return useSearchDomain<Foo, FooSearchParams>(
    "fooes/search",
    search,
    params,
  );
};
