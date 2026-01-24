// src/features/__domain__/hooks/useBulkUpsert__Domain__.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { __Domain__CreateFields } from "../entities/form";

export const useBulkUpsert__Domain__ = () => {
  const bulkUpsert = __domain__Client.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("__Domain__の一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<__Domain__, __Domain__CreateFields>(
    "__domains__/bulk-upsert",
    bulkUpsert,
    "__domains__",
  );
};
