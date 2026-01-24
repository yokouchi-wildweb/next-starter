// src/features/__domain__/hooks/useReorder__Domain__.ts

"use client";

import { useReorderDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { __Domain__ } from "../entities";

export const useReorder__Domain__ = () => {
  const reorder = __domain__Client.reorder;

  if (!reorder) {
    throw new Error("__Domain__の並び替え機能が利用できません");
  }

  return useReorderDomain<__Domain__>("__domains__/reorder", reorder, "__domains__");
};
