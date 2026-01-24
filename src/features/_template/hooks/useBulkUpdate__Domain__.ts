// src/features/__domain__/hooks/useBulkUpdate__Domain__.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";
import type { __Domain__UpdateFields } from "../entities/form";

export const useBulkUpdate__Domain__ = () => {
  const bulkUpdate = __domain__Client.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("__Domain__の一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<__Domain__, __Domain__UpdateFields>(
    "__domains__/bulk-update",
    bulkUpdate,
    "__domains__",
  );
};
