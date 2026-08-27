"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { ReplaceByQueryOptions, WhereExpr } from "../types";
import type { HttpError } from "@/lib/errors";
import { revalidateRelatedCaches } from "./revalidateRelatedCaches";

/**
 * where 一致行を records で丸ごと置き換えるフック（単一トランザクション・Drizzle のみ）
 */
type ReplaceByQueryArg<A> = {
  where: WhereExpr;
  records: A[];
  options?: ReplaceByQueryOptions;
};

export function useReplaceByQueryDomain<T, A = Partial<T>>(
  key: string,
  replaceByQueryFn: (
    where: WhereExpr,
    records: A[],
    options?: ReplaceByQueryOptions,
  ) => Promise<T[]>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<T[], HttpError, string, ReplaceByQueryArg<A>>(
    key,
    (_key, { arg }) => replaceByQueryFn(arg.where, arg.records, arg.options),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await revalidateRelatedCaches(mutate, revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (where: WhereExpr, records: A[], options?: ReplaceByQueryOptions) =>
      (mutation.trigger as (arg: ReplaceByQueryArg<A>) => Promise<T[]>)({
        where,
        records,
        options,
      }),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
