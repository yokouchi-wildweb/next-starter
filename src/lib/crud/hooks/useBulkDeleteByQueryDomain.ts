"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "./revalidateRelatedCaches";
import type { WhereExpr } from "@/lib/crud/types";

/**
 * where 条件での複数削除用フック
 */
export function useBulkDeleteByQueryDomain(
  key: string,
  bulkDeleteByQueryFn: (where: WhereExpr) => Promise<void>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<void, HttpError, string, WhereExpr>(
    key,
    (_key, { arg }) => bulkDeleteByQueryFn(arg),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await revalidateRelatedCaches(mutate, revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (where: WhereExpr) =>
      (mutation.trigger as (where: WhereExpr) => Promise<void>)(where),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
