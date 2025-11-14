"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { UpsertOptions } from "../types";
import type { HttpError } from "@/lib/errors";

/**
 * 存在すれば更新、無ければ作成するフック
 */
type UpsertArg<A> = { data: A; options?: UpsertOptions<A> };

export function useUpsertDomain<T, A = Partial<T>>(
  key: string,
  upsertFn: (data: A, options?: UpsertOptions<A>) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<T, HttpError, string, UpsertArg<A>>(
    key,
    (_key, { arg }) => upsertFn(arg.data, arg.options),
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await mutate(revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (data: A, options?: UpsertOptions<A>) =>
      (mutation.trigger as (arg: UpsertArg<A>) => Promise<T>)({ data, options }),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
