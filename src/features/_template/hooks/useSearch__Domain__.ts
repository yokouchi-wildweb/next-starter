// src/features/__domain__/hooks/useSearch__Domain__.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type __Domain__SearchParams = typeof __domain__Client.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearch__Domain__ = (params: __Domain__SearchParams) => {
  const search = __domain__Client.search;

  if (!search) {
    throw new Error("__Domain__の検索機能が利用できません");
  }

  return useSearchDomain<__Domain__, __Domain__SearchParams>(
    "__domains__/search",
    search,
    params,
  );
};
