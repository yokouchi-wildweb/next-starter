"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { HttpError } from "@/lib/errors";
import type { DuplicateOptions } from "../types";
import { revalidateRelatedCaches } from "./revalidateRelatedCaches";

type DuplicateArg = {
  id: string;
  options?: DuplicateOptions;
};

/**
 * ドメインデータを複製するためのフック
 */
export function useDuplicateDomain<T>(
  key: string,
  duplicateFn: (id: string, options?: DuplicateOptions) => Promise<T>,
  revalidateKey?: string | string[],
) {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<T, HttpError, string, DuplicateArg>(
    key,
    (_key, { arg }) => {
      return duplicateFn(arg.id, arg.options);
    },
    {
      onSuccess: async () => {
        if (revalidateKey) {
          await revalidateRelatedCaches(mutate, revalidateKey);
        }
      },
    },
  );

  return {
    trigger: (id: string, options?: DuplicateOptions) => mutation.trigger({ id, options }),
    isMutating: mutation.isMutating,
    isLoading: mutation.isMutating,
    error: mutation.error,
  };
}
