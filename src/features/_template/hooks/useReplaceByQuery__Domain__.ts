// src/features/__domain__/hooks/useReplaceByQuery__Domain__.ts

"use client";

import { useReplaceByQueryDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { __Domain__CreateFields } from "../entities/form";

export const useReplaceByQuery__Domain__ = () => {
  const replaceByQuery = __domain__Client.replaceByQuery;

  if (!replaceByQuery) {
    throw new Error("__Domain__の条件指定一括置換機能が利用できません");
  }

  return useReplaceByQueryDomain<__Domain__, __Domain__CreateFields>(
    "__domains__/replace-by-query",
    replaceByQuery,
    "__domains__",
  );
};
