// src/features/__domain__/hooks/useUpsert__Domain__.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { __Domain__CreateFields } from "../entities/form";

export const useUpsert__Domain__ = () => {
  const upsert = __domain__Client.upsert;

  if (!upsert) {
    throw new Error("__Domain__のアップサート機能が利用できません");
  }

  return useUpsertDomain<__Domain__, __Domain__CreateFields>(
    "__domains__/upsert",
    upsert,
    "__domains__",
  );
};
