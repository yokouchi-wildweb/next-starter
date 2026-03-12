// src/features/__domain__/hooks/useCount__Domain__.ts

"use client";

import { useCountDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";
import type { CountParams } from "@/lib/crud/types";

export const useCount__Domain__ = (params: CountParams) => {
  const count = __domain__Client.count;

  if (!count) {
    throw new Error("__Domain__のカウント機能が利用できません");
  }

  return useCountDomain<CountParams>(
    "__domains__/count",
    count,
    params,
  );
};
